/**
 * Shared domain types for the AI-Powered Code Migration Tool.
 *
 * The `CodemodSpec` is the canonical contract between the LLM, the
 * regex-based applier, the verifier, the diff UI and the persistence
 * layer. It is intentionally minimal — a list of `Pattern` entries
 * (regex `match` + literal `replace`, optional language filter) plus a
 * `VerificationSpec` describing how to validate the post-transform code.
 */

/** Language filter accepted values; `undefined` means "apply to any file". */
export type Language = 'js' | 'ts' | 'jsx' | 'tsx' | 'json' | 'css' | 'html' | 'md'

/** One regex→string rewrite rule. Patterns are applied sequentially. */
export interface Pattern {
  /** RegExp source string (without surrounding `/`). Must be PCRE-compatible enough for the JS RegExp engine. */
  match: string
  /** Replacement string. May contain `$1`-style capture groups. */
  replace: string
  /** Optional flag string e.g. "g" (always treated as global by the applier). */
  flags?: string
  /** Optional language filter — only apply this pattern when the file's extension matches. */
  language?: Language
}

/** How to verify a transformed code blob. */
export interface VerificationSpec {
  /** `regex-no-match`: assert that the `target` regex no longer appears in the transformed code.
   *  `test-pass`: stub that returns `{ ok: true }` for the MVP. Real test execution is a stretch goal. */
  type: 'regex-no-match' | 'test-pass'
  /** For `regex-no-match`: the regex source to search for. For `test-pass`: the test command (informational only for MVP). */
  target?: string
}

/** The full codemod specification produced by the LLM and persisted as Migration.codemod. */
export interface CodemodSpec {
  name: string
  description: string
  patterns: Pattern[]
  verification: VerificationSpec
}

/** Manual migration checklist — markdown checkboxes the LLM emits alongside the codemod. */
export interface ChecklistItem {
  id: string
  text: string
  done: boolean
}

/** Result of `applyCodemod(code, codemod, filePath?)`. */
export interface ApplyResult {
  newCode: string
  matchCount: number
  replacements: number
}

/** Result of `verify(code, verification)`. */
export interface VerifyResult {
  ok: boolean
  reason: string
}

/** Persisted application record — shape mirrored from Prisma. */
export interface MigrationApplicationDTO {
  id: string
  migrationId: string
  filePath: string
  originalCode: string
  transformedCode: string
  matchCount: number
  replacements: number
  verificationStatus: string | null
  appliedAt: string | null
  rolledBackAt: string | null
  createdAt: string
}

/** Migration DTO returned to the frontend (includes parsed codemod + checklist). */
export interface MigrationDTO {
  id: string
  name: string
  description: string
  codemod: CodemodSpec
  checklist: ChecklistItem[]
  status: string
  createdAt: string
  updatedAt: string
  applications: MigrationApplicationDTO[]
}

/** Preview API response. */
export interface PreviewResponse {
  newCode: string
  diff: string
  matchCount: number
  replacements: number
  verificationStatus: 'passed' | 'failed' | 'skipped'
  verificationReason: string
}
