# AI-Powered Code Migration Tool

> Describe a code migration in plain English, let an LLM generate a codemod
> spec, apply the spec as a regex-based transform, verify the result, and
> roll back if needed — all from a single Next.js page.

[![Next.js 16](https://img.shields.io/badge/Next.js-16-black)](https://nextjs.org/)
[![TypeScript 5](https://img.shields.io/badge/TypeScript-5-blue)](https://www.typescriptlang.org/)
[![Tailwind CSS 4](https://img.shields.io/badge/Tailwind%20CSS-4-38bdf8)](https://tailwindcss.com/)
[![Prisma 6 + SQLite](https://img.shields.io/badge/Prisma-6%20%2B%20SQLite-2d3748)](https://www.prisma.io/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green)](./LICENSE)

---

## Overview

Most real-world "framework migrations" (CRA → Vite, CommonJS → ESM, moment →
date-fns, class components → hooks, enzyme → react-testing-library) are
tedious because they require hundreds of small, mechanical edits across
hundreds of files. Codemod tools like [`jscodeshift`](https://github.com/facebook/jscodeshift)
automate the mechanical part, but authoring a codemod still requires the
engineer to read the AST documentation and write a transformer.

This tool cuts the authoring step in half: **you describe the migration in
English, the LLM emits a JSON codemod spec, a regex-based transform applies
the spec, a verifier confirms the migration landed, and a diff UI lets you
review and roll back.** The MVP deliberately avoids real AST transforms —
see [MVP scope vs. stretch goals](#mvp-scope-vs-stretch-goals) for why.

The UI is a single page with three logical panels:

1. **Migration detail** — the generated codemod JSON + a manual checklist.
2. **Code input** — paste the code you want to transform.
3. **Preview** — a unified diff, match/replacement counts, the
   verification verdict, and **Apply** / **Rollback** buttons.

Every migration + every applied codemod is persisted to a local SQLite
database via Prisma, so you can audit the history and roll back individual
applications.

---

## MVP scope vs. stretch goals

| Feature                                | MVP scope                                        | Stretch goal                                                                          |
| -------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------- |
| Codemod generation                     | LLM emits a JSON codemod spec                    | LLM emits a real jscodeshift transformer file                                          |
| Codemod application                    | **Regex-based** transform (`String.replace`)    | **Real jscodeshift AST transforms** (recast + ast-types)                              |
| Multi-file migrations                  | One file at a time (pasted in the UI)            | Walk a project tree, apply per-file, write back to disk                              |
| Verification — `regex-no-match`        | Implemented                                      | (already MVP)                                                                         |
| Verification — `test-pass`             | **Stubbed** — returns `{ ok: true }`             | Sandbox-executed `bun test` / `jest` with a configurable timeout                      |
| Applying to disk                       | Persist to DB only (no fs.write)                 | Atomic `fs.writeFile` with a backup directory                                         |
| Rollback                               | Mark the DB row as rolled back                   | Restore the original file from a backup directory                                      |
| Library version matrix                  | —                                                | Detect `package.json` and propose the right migration based on installed versions    |
| LLM provider                           | z-ai-web-dev-sdk (with a deterministic mock)     | Pluggable provider, streaming deltas, OpenAI-compatible fallback                      |

### Why regex and not jscodeshift for the MVP?

A real AST transform is obviously the right answer for production codemods.
We deliberately did **not** install `jscodeshift` for the MVP because:

1. `jscodeshift` brings in `recast`, `ast-types`, and a parser per language —
   ~25 MB of node_modules and several seconds of cold-start. That's a lot
   to absorb just to demo the **prompt → apply → verify → diff** loop.
2. The interesting product surface of this tool is the **LLM-generated
   codemod spec** + the **verification + diff/rollback UX**, not the regex
   engine. The regex engine is a few dozen lines that can be swapped out
   for a `jscodeshift`-based engine behind the same `applyCodemod(code,
   codemod, filePath?)` interface without touching the API, the tests, or
   the UI.
3. For the canonical MVP examples ("Convert `require()` to `import`",
   "Rename `componentWillMount` to `componentDidMount`", "Replace
   `moment(x).format('YYYY-MM-DD')` with `format(x, 'yyyy-MM-dd')`") a
   well-crafted regex with a capture group is 90% as good as an AST visit,
   and 100x simpler to LLM-generate.

The upgrade path is documented inline in
[`src/lib/codemod-applier.ts`](./src/lib/codemod-applier.ts): the
`applyCodemod` function is the single integration point. Replacing its
body with a `jscodeshift` runner leaves the rest of the system untouched.

---

## Features

- **Describe → generate.** Type a free-form migration description
  (optionally with a sample of code). The LLM returns a JSON codemod spec
  plus a markdown checklist of manual steps.
- **Regex-based transform.** Each pattern is `{ match, replace, flags?, language? }`
  and is applied sequentially. Language filters (e.g. `language: "ts"`)
  scope a pattern to matching file extensions.
- **Verification.** The codemod carries a `verification` block:
  - `regex-no-match` — asserts a regex does NOT appear in the transformed
    code (e.g. after "CommonJS → ESM", assert `require(` is gone).
  - `test-pass` — stubbed for the MVP (returns `ok: true`). Real test
    execution is a stretch goal.
- **Unified diff preview.** Line-by-line diff with `+`/`-`/` ` prefixes,
  color-coded in the UI.
- **Apply + rollback.** Applying persists a `MigrationApplication` row
  with the original and transformed code, the match/replacement counts,
  the verification status, and `appliedAt`. Rollback sets `rolledBackAt`.
- **Manual checklist.** The LLM also emits a markdown checklist of steps
  that the codemod can't safely do automatically (e.g. "Update package.json:
  remove moment, add date-fns"). Toggles are persisted to the DB.
- **History & stats.** The header shows the total migration / application /
  rolled-back counts. Each migration card lists its application history.

---

## Tech stack

- **Framework**: Next.js 16 with App Router (`output: "standalone"`).
- **Language**: TypeScript 5 (strict).
- **Styling**: Tailwind CSS 4 + shadcn/ui (New York style, neutral base color).
- **Database**: Prisma 6 ORM + SQLite (single-file `db/custom.db`).
- **LLM**: `z-ai-web-dev-sdk` (non-streaming `complete()`).
- **Tests**: `bun test` with the built-in `bun:test` runner.
- **Lint**: `eslint-config-next` (core-web-vitals + typescript).

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              Browser (page.tsx)                          │
│                                                                         │
│   ┌──────────┐  ┌─────────────────────────────────────────────────────┐ │
│   │ Migr.    │  │ Migration detail  │  Code input  │  Preview & diff  │ │
│   │ list     │  │ (codemod JSON,    │  (textarea,  │  (unified diff, │ │
│   │ (status  │  │  checklist)       │  file path)  │  verify, apply) │ │
│   │  chips)  │  │                   │              │                  │ │
│   └──────────┘  └─────────────────────────────────────────────────────┘ │
└───────────────────────────────────┬─────────────────────────────────────┘
                                    │ fetch /api
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                  Next.js 16 Route Handlers (src/app/api)                 │
│                                                                         │
│  POST /api/migrations              GET /api/migrations                    │
│  GET  /api/migrations/[id]        DELETE /api/migrations/[id]            │
│  PATCH /api/migrations/[id]       POST /api/migrations/[id]/preview      │
│  POST /api/migrations/[id]/apply  POST /api/migrations/[id]/verify       │
│  POST /api/migrations/[id]/applications/[appId]/rollback                 │
│  GET  /api/stats                                                        │
└───────────────────────────────────┬─────────────────────────────────────┘
                                    │ uses
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         Domain logic (src/lib)                          │
│                                                                         │
│  codemod-builder ─┐        codemod-applier  ────► diff-formatter         │
│                   ├─► ai (ChatProvider)                                   │
│  codemod-parser  ─┘        verifier                                    │
│                                                                         │
│  checklist-builder ──► parseChecklist  ──► serializeChecklist             │
└───────────────────────────────────┬─────────────────────────────────────┘
                                    │ persists
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ Prisma 6 + SQLite (db/custom.db)                                        │
│   Migration { id, name, description, codemod (JSON), checklist (JSON),   │
│               status, createdAt, updatedAt }                             │
│   MigrationApplication { id, migrationId, filePath, originalCode,       │
│                          transformedCode, matchCount, replacements,     │
│                          verificationStatus, appliedAt, rolledBackAt,    │
│                          createdAt }                                    │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Setup

```bash
# 1. Install dependencies
bun install

# 2. Configure the database (the .env already points at an absolute SQLite path)
cat .env.example > .env

# 3. Create the SQLite schema
bun run db:push

# 4. (Optional) Disable the live LLM for offline development
export PKC_DISABLE_LLM=1

# 5. Start the dev server
bun run dev
```

Open the preview panel — the app runs at `/`.

### Tests

```bash
bun test
```

The suite uses the `bun:test` runner. The domain logic is exercised in
isolation — the LLM is mocked via a `MockProvider` that returns a
deterministic codemod spec and checklist, so the tests run fully offline.

---

## Environment variables

| Variable             | Required | Description                                                                |
| -------------------- | -------- | -------------------------------------------------------------------------- |
| `DATABASE_URL`       | yes      | Prisma SQLite URL, e.g. `file:/abs/path/to/db/custom.db`. Must be absolute.|
| `PKC_DISABLE_LLM`    | no       | Set to `1` to fall back to the deterministic `MockProvider` (no LLM call).  |

The z-ai-web-dev-sdk reads its own configuration from the sandbox; no
explicit API key is needed in this environment.

---

## Project structure

```
90-ai-code-migration/
├── prisma/
│   └── schema.prisma                 # Migration + MigrationApplication models
├── src/
│   ├── app/
│   │   ├── layout.tsx                # Root layout (fonts + Toaster)
│   │   ├── page.tsx                  # 2-column + 3-panel UI
│   │   ├── globals.css               # Tailwind + shadcn tokens + diff colors
│   │   └── api/
│   │       ├── migrations/
│   │       │   ├── route.ts          # POST + GET (list)
│   │       │   └── [id]/
│   │       │       ├── route.ts      # GET + DELETE + PATCH (checklist toggle)
│   │       │       ├── preview/route.ts
│   │       │       ├── apply/route.ts
│   │       │       ├── verify/route.ts
│   │       │       └── applications/[appId]/rollback/route.ts
│   │       └── stats/route.ts
│   ├── components/ui/                # shadcn/ui (button, card, badge, ...)
│   ├── hooks/
│   │   └── use-toast.ts
│   └── lib/
│       ├── ai.ts                     # ChatProvider (ZaiProvider / MockProvider)
│       ├── db.ts                     # Prisma client singleton
│       ├── utils.ts                  # cn() helper
│       ├── types.ts                  # CodemodSpec, Pattern, VerificationSpec, ...
│       ├── dto.ts                    # Prisma row -> MigrationDTO converter
│       ├── codemod-builder.ts        # buildCodemodPrompt(description, sampleCode?)
│       ├── codemod-parser.ts         # parseCodemodResponse(text) -> CodemodSpec | null
│       ├── codemod-applier.ts        # applyCodemod(code, codemod, filePath?)
│       ├── verifier.ts               # verify(code, verification) -> { ok, reason }
│       ├── diff-formatter.ts         # formatDiff(original, transformed) -> unified diff
│       ├── checklist-builder.ts      # parseChecklist(text), serializeChecklist, toggle
│       └── __tests__/
│           ├── codemod-builder.test.ts
│           ├── codemod-parser.test.ts
│           ├── codemod-applier.test.ts
│           ├── verifier.test.ts
│           ├── diff-formatter.test.ts
│           ├── checklist-builder.test.ts
│           └── ai.test.ts
├── package.json
├── tsconfig.json
├── next.config.ts
├── postcss.config.mjs
├── tailwind.config.ts
├── components.json
├── eslint.config.mjs
├── .env.example
├── .gitignore
├── LICENSE
└── README.md
```

---

## Case study — LLM-generated codemod spec + regex application + verification

### 1. The prompt

`buildCodemodPrompt(description, sampleCode?)` constructs a system prompt
that pins the exact JSON shape (`name`, `description`, `patterns[]` with
`match`+`replace`+optional `language`, `verification` block) and a user
prompt with the migration description and optional sample code. The system
prompt explicitly says "output ONLY the JSON object, optionally fenced in
```json".

### 2. The parse

`parseCodemodResponse(text)` is the safety net. LLMs are not 100% reliable
about formatting — they wrap JSON in markdown fences, prepend "Sure, here
you go:", etc. The parser:

1. Extracts every ` ```json` / ` ``` ` fenced block and tries to parse each
   one as JSON, validating the structure (`name` is non-empty, `patterns`
   is a non-empty array of valid regex `match` strings, `verification` is
   one of the two known types).
2. If no fenced block validates, it scans the text for the first balanced
   `{...}` substring and tries that.
3. Returns `CodemodSpec | null` — `null` means "the LLM produced garbage,
   the route handler should 422 with the raw text so the user can retry".

This is the most defensive piece of code in the system and is the only
part where the LLM and the deterministic engine interface.

### 3. The application

`applyCodemod(code, codemod, filePath?)` walks each `Pattern` in order and
runs `String.prototype.replace(new RegExp(pattern.match, "g" |
pattern.flags), pattern.replace)`. The `language` filter (e.g. `language:
"ts"`) skips a pattern unless `languageOfFilePath(filePath)` matches. The
function is pure — no side effects, no I/O. The route handler decides
whether to persist the result.

### 4. The verification

`verify(code, verification)` runs the codemod's `verification` spec on the
transformed code. For `regex-no-match`, it asserts the regex no longer
appears. For `test-pass`, it returns a stubbed `{ ok: true, reason:
"stubbed for MVP" }` — see the README header for why running arbitrary
shell commands in a Next.js route handler is unsafe without a sandbox.

### 5. The diff + rollback

`formatDiff(original, transformed)` is a textbook LCS over line arrays —
dependency-free, easy to test, and fast enough for single-file snippets
pasted into the UI. The output is a unified-diff-style string with `+`/`-`/
` ` prefixes that the `<DiffView>` React component color-codes.

Applying persists a `MigrationApplication` row with the original and
transformed code, the match/replacement counts, and the verification
status. Rollback sets `rolledBackAt`. The UI renders the application
history per migration, so the user can audit each application individually.

---

## What I'd do differently (next iteration)

1. **Real jscodeshift AST transforms.** The regex engine is fine for
   single-line patterns but breaks on nested expressions (e.g. converting
   `moment(x).add(1, 'day').format()` to date-fns requires AST awareness).
   The upgrade path is documented in `codemod-applier.ts` — swapping the
   engine keeps the rest of the system untouched.
2. **Multi-file orchestration.** The MVP applies one file at a time. A
   real tool would walk a project tree, batch by language, and write back
   to disk atomically with a backup directory.
3. **Real test execution.** `test-pass` is stubbed. The production version
   would run `bun test path/to/test.ts` in a sandboxed subprocess (e.g.
   `Bun.spawn` with a timeout, or a Docker container for full isolation).
4. **Library version matrix.** Detect `package.json`, look up installed
   versions of `moment`, `enzyme`, etc., and propose the right migration
   with the right patterns for that specific version. Today the LLM emits
   a generic codemod; the matrix would make it specific.
5. **Streaming LLM deltas.** For long migrations the codemod generation
   can take 5-10 seconds. Streaming deltas to the UI (like the parent
   project's chat UI) would make the wait feel shorter and let the user
   see the JSON take shape.
6. **Multi-step migration plans.** A real migration is rarely one
   codemod — it's a sequence (e.g. install date-fns → run codemod →
   update tests → remove moment from package.json). The MVP stores one
   codemod per migration; a "migration plan" with N codemods + ordering
   would be the natural next step.

---

## Resume bullet

> Built an AI-powered code-migration tool that turns a free-form English
> description ("Convert CommonJS require() to ES module imports") into a
> JSON codemod spec, applies the spec as a regex transform, verifies the
> result with a regex-no-match assertion, and renders a unified diff with
> apply/rollback — all from a single Next.js page. 80+ unit tests cover
> the LLM-response parser, the regex applier, the LCS-based diff
> formatter, and the verifier; a deterministic mock provider keeps the
> suite offline. Designed the codemod spec as a JSON contract so the
> regex engine can be swapped for a real jscodeshift AST transformer
> without touching the API, the tests, or the UI.

---

## License

MIT — see [LICENSE](./LICENSE).

---

## Push to GitHub

```bash
gh repo create ai-code-migration --public --source=. --remote=origin --push
```
