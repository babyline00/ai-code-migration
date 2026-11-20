/**
 * POST /api/migrations/[id]/verify — body: `{ code }`.
 * Loads the persisted codemod, runs the verification spec on the provided code,
 * returns `{ ok, reason }`.
 *
 * Useful as a standalone endpoint when the user wants to re-verify a piece of
 * transformed code without re-running the full preview pipeline. The preview
 * endpoint runs the same verifier inline.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verify } from "@/lib/verifier";
import type { CodemodSpec, VerifyResult } from "@/lib/types";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  let body: { code?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const code = body?.code ?? "";
  if (typeof code !== "string") {
    return NextResponse.json({ error: "code must be a string" }, { status: 400 });
  }

  let row: { codemod: string } | null = null;
  try {
    row = await db.migration.findUnique({ where: { id }, select: { codemod: true } });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
  if (!row) return NextResponse.json({ error: "Migration not found" }, { status: 404 });

  let codemod: CodemodSpec;
  try {
    codemod = JSON.parse(row.codemod) as CodemodSpec;
  } catch {
    return NextResponse.json({ error: "Stored codemod is malformed" }, { status: 500 });
  }

  const result: VerifyResult = verify(code, codemod.verification);
  return NextResponse.json(result);
}
