/**
 * POST /api/migrations/[id]/apply — body: `{ filePath, code }`.
 *
 * 1. Re-applies the codemod to the input code (so the persisted `transformedCode`
 *    matches what the user saw in the preview).
 * 2. Runs the verification spec on the transformed code.
 * 3. Persists a MigrationApplication row with `appliedAt = now()` and the
 *    verification status.
 *
 * MVP scope: the application is persisted to the DB only — disk-write is a
 * stretch goal. The persisted `transformedCode` is what a future disk-write
 * step would emit.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { applyCodemod } from "@/lib/codemod-applier";
import { verify } from "@/lib/verifier";
import type { CodemodSpec } from "@/lib/types";
import { toApplicationDTO } from "@/lib/dto";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  let body: { filePath?: string; code?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const filePath = (body?.filePath ?? "").trim();
  const code = body?.code ?? "";
  if (!filePath) {
    return NextResponse.json({ error: "filePath is required" }, { status: 400 });
  }
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
  const verification = verify(newCode, codemod.verification);
  const verificationStatus = verification.ok ? "passed" : "failed";

  try {
    const app = await db.migrationApplication.create({
      data: {
        migrationId: id,
        filePath,
        originalCode: code,
        transformedCode: newCode,
        matchCount,
        replacements,
        verificationStatus,
        appliedAt: new Date(),
      },
    });
    // Bump migration status to "applied" the first time an application is persisted.
    await db.migration.updateMany({
      where: { id, status: { not: "applied" } },
      data: { status: "applied" },
    });
    return NextResponse.json(toApplicationDTO(app), { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
