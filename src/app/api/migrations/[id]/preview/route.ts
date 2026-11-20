/**
 * POST /api/migrations/[id]/preview — body: `{ code, filePath? }`.
 * Applies the persisted codemod (regex transform) to the input code WITHOUT
 * persisting. Returns a PreviewResponse: newCode, unified diff, matchCount,
 * replacements, verificationStatus, verificationReason.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { applyCodemod } from "@/lib/codemod-applier";
import { formatDiff } from "@/lib/diff-formatter";
import { verify } from "@/lib/verifier";
import type { CodemodSpec, PreviewResponse } from "@/lib/types";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  let body: { code?: string; filePath?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const code = body?.code ?? "";
  const filePath = body?.filePath;
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

  const { newCode, matchCount, replacements } = applyCodemod(code, codemod, filePath);
  const diff = formatDiff(code, newCode);

  let verificationStatus: PreviewResponse["verificationStatus"] = "skipped";
  let verificationReason = "Verification skipped — no replacements made.";
  if (replacements > 0) {
    const result = verify(newCode, codemod.verification);
    verificationStatus = result.ok ? "passed" : "failed";
    verificationReason = result.reason;
  }

  const response: PreviewResponse = {
    newCode,
    diff,
    matchCount,
    replacements,
    verificationStatus,
    verificationReason,
  };
  return NextResponse.json(response);
}
