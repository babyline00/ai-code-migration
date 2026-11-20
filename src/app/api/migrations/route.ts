/**
 * POST /api/migrations — body: `{ description, sampleCode? }`.
 * 1. Builds the codemod prompt, calls the LLM, parses with parseCodemodResponse.
 * 2. Builds a separate checklist prompt, calls the LLM again, parses with
 *    parseChecklist.
 * 3. Persists a Migration row with `codemod` and `checklist` JSON-stringified.
 * 4. Returns the MigrationDTO.
 *
 * GET /api/migrations — list all migrations (with applications).
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getChatProvider } from "@/lib/ai";
import { buildCodemodPrompt } from "@/lib/codemod-builder";
import { parseCodemodResponse } from "@/lib/codemod-parser";
import { parseChecklist } from "@/lib/checklist-builder";
import { toMigrationDTO } from "@/lib/dto";
import type { ChecklistItem, CodemodSpec } from "@/lib/types";

const CHECKLIST_SYSTEM_PROMPT = [
  "You are an AI code-migration assistant producing a manual migration checklist.",
  "Output a markdown checklist of the manual steps the engineer should perform BEFORE or AFTER the codemod runs —",
  "things like updating package.json, renaming files, auditing calls the codemod cannot statically rewrite,",
  "updating CI configs, etc. Use the format `- [ ] step description` (one per line). Do not wrap the checklist in code fences.",
  "Output ONLY the markdown checklist — no prose before or after.",
].join("\n");

export async function GET() {
  try {
    const rows = await db.migration.findMany({
      orderBy: { createdAt: "desc" },
      include: { applications: { orderBy: { createdAt: "desc" } } },
    });
    return NextResponse.json(rows.map(toMigrationDTO));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  let body: { description?: string; sampleCode?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const description = (body?.description ?? "").trim();
  const sampleCode = (body?.sampleCode ?? "").trim() || undefined;
  if (description.length === 0) {
    return NextResponse.json({ error: "description is required" }, { status: 400 });
  }

  const provider = getChatProvider();

  // 1) Codemod generation.
  const codemodPrompt = buildCodemodPrompt(description, sampleCode);
  let codemod: CodemodSpec | null = null;
  let codemodRaw = "";
  try {
    codemodRaw = await provider.complete({
      systemPrompt: codemodPrompt.systemPrompt,
      userPrompt: codemodPrompt.userPrompt,
    });
    codemod = parseCodemodResponse(codemodRaw);
  } catch (e) {
    return NextResponse.json(
      { error: `Codemod generation failed: ${(e as Error).message}` },
      { status: 502 },
    );
  }
  if (!codemod) {
    return NextResponse.json(
      { error: "Codemod response could not be parsed as a valid spec.", raw: codemodRaw.slice(0, 1000) },
      { status: 422 },
    );
  }

  // 2) Checklist generation (second LLM call).
  let checklist: ChecklistItem[] = [];
  try {
    const checklistUserPrompt = `Migration: ${description}\n\nCodemod: ${JSON.stringify(codemod)}\n\nProduce the manual checklist now.`;
    const checklistRaw = await provider.complete({
      systemPrompt: CHECKLIST_SYSTEM_PROMPT,
      userPrompt: checklistUserPrompt,
    });
    checklist = parseChecklist(checklistRaw);
  } catch {
    // Checklist is best-effort — the migration is still usable without it.
    checklist = [];
  }

  // 3) Persist.
  try {
    const created = await db.migration.create({
      data: {
        name: codemod.name,
        description: codemod.description || description,
        codemod: JSON.stringify(codemod),
        checklist: JSON.stringify(checklist),
        status: "ready",
      },
      include: { applications: true },
    });
    return NextResponse.json(toMigrationDTO(created), { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
