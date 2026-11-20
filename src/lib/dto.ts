/**
 * DTO helpers — convert Prisma rows to the JSON shape the frontend expects.
 * The codemod and checklist columns are stored as JSON strings, so we parse
 * them here and merge applications.
 */

import type {
  CodemodSpec,
  ChecklistItem,
  MigrationApplicationDTO,
  MigrationDTO,
} from "@/lib/types";

import type { Migration, MigrationApplication } from "@prisma/client";

export function toApplicationDTO(a: MigrationApplication): MigrationApplicationDTO {
  return {
    id: a.id,
    migrationId: a.migrationId,
    filePath: a.filePath,
    originalCode: a.originalCode,
    transformedCode: a.transformedCode,
    matchCount: a.matchCount,
    replacements: a.replacements,
    verificationStatus: a.verificationStatus,
    appliedAt: a.appliedAt ? a.appliedAt.toISOString() : null,
    rolledBackAt: a.rolledBackAt ? a.rolledBackAt.toISOString() : null,
    createdAt: a.createdAt.toISOString(),
  };
}

export function toMigrationDTO(
  m: Migration & { applications?: MigrationApplication[] },
): MigrationDTO {
  let codemod: CodemodSpec | null = null;
  try {
    codemod = JSON.parse(m.codemod) as CodemodSpec;
  } catch {
    codemod = null;
  }
  let checklist: ChecklistItem[] = [];
  try {
    checklist = JSON.parse(m.checklist) as ChecklistItem[];
  } catch {
    checklist = [];
  }
  return {
    id: m.id,
    name: m.name,
    description: m.description,
    codemod: codemod ?? {
      name: m.name,
      description: m.description,
      patterns: [],
      verification: { type: "regex-no-match", target: "" },
    },
    checklist,
    status: m.status,
    createdAt: m.createdAt.toISOString(),
    updatedAt: m.updatedAt.toISOString(),
    applications: (m.applications ?? []).map(toApplicationDTO),
  };
}
