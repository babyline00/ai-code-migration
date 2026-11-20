/**
 * GET    /api/migrations/[id] — fetch a single migration with its applications.
 * DELETE /api/migrations/[id] — delete a migration (cascade deletes applications).
 * PATCH  /api/migrations/[id] — body: `{ checklist?: ChecklistItem[] }` — update the
 *                                persisted checklist (used by the UI to persist checkbox toggles).
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { toMigrationDTO } from "@/lib/dto";
import type { ChecklistItem } from "@/lib/types";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const row = await db.migration.findUnique({
      where: { id },
      include: { applications: { orderBy: { createdAt: "desc" } } },
    });
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(toMigrationDTO(row));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const existing = await db.migration.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await db.migration.delete({ where: { id } });
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  let body: { checklist?: ChecklistItem[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!Array.isArray(body?.checklist)) {
    return NextResponse.json({ error: "checklist must be an array" }, { status: 400 });
  }
  try {
    const existing = await db.migration.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const updated = await db.migration.update({
      where: { id },
      data: { checklist: JSON.stringify(body.checklist) },
      include: { applications: { orderBy: { createdAt: "desc" } } },
    });
    return NextResponse.json(toMigrationDTO(updated));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
