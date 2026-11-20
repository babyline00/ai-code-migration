/**
 * GET /api/stats — `{ migrations, applications, rolledBack }`.
 * Aggregate counts used by the page header. The `rolledBack` count is the
 * number of MigrationApplication rows whose `rolledBackAt` is non-null.
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const [migrations, applications, rolledBack] = await Promise.all([
      db.migration.count(),
      db.migrationApplication.count(),
      db.migrationApplication.count({ where: { rolledBackAt: { not: null } } }),
    ]);
    return NextResponse.json({ migrations, applications, rolledBack });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
