/**
 * POST /api/migrations/[id]/applications/[appId]/rollback — set `rolledBackAt`.
 *
 * Idempotent: rolling back an already-rolled-back application returns 200
 * with the existing `rolledBackAt` value preserved.
 *
 * MVP scope: this only updates the DB row; the original (pre-transform) code
 * is restored on the UI by reverting to the persisted `originalCode` column.
 * Real disk rollback is a stretch goal — see README.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { toApplicationDTO } from "@/lib/dto";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; appId: string }> },
) {
  const { id, appId } = await params;
  try {
    const existing = await db.migrationApplication.findUnique({
      where: { id: appId },
    });
    if (!existing) return NextResponse.json({ error: "Application not found" }, { status: 404 });
    if (existing.migrationId !== id) {
      return NextResponse.json({ error: "Application does not belong to this migration" }, { status: 400 });
    }
    if (existing.rolledBackAt) {
      return NextResponse.json(toApplicationDTO(existing));
    }
    const updated = await db.migrationApplication.update({
      where: { id: appId },
      data: { rolledBackAt: new Date() },
    });
    return NextResponse.json(toApplicationDTO(updated));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
