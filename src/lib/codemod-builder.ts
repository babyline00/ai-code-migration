/**
 * Codemod prompt builder.
 *
 * `buildCodemodPrompt(description, sampleCode?)` constructs the system + user
 * messages that ask the LLM to produce a `CodemodSpec` JSON document for the
 * given migration description. The system prompt pins down the exact JSON
 * shape the rest of the pipeline expects, so `parseCodemodResponse` can
 * validate the output structurally.
 *
 * The prompt deliberately:
 *  - Asks for a single JSON object (optionally fenced in ```json blocks).
 *  - Asks for one or more `patterns`, each with a JS-compatible `match`
 *    regex source and a literal `replace` string (with `$1` capture groups).
 *  - Asks for a `verification` block of type `regex-no-match` or `test-pass`.
 *
 * It does NOT ask the LLM to actually run code or test commands — the
 * verifier handles that.
 */

import type { CodemodSpec } from './types'

const SYSTEM_PROMPT = [
  'You are an AI code-migration assistant. You produce a JSON codemod specification.',
  'Respond with a single JSON object, optionally wrapped in a ```json fenced block.',
  '',
  'The JSON object MUST have this exact shape:',
  '{',
  '  "name": string,           // short kebab-case identifier, e.g. "commonjs-to-esm"',
  '  "description": string,    // 1-2 sentence human-readable summary',
  '  "patterns": [',
  '    {',
  '      "match": string,      // JS RegExp source (no surrounding slashes), e.g. "const\\\\s+(\\\\w+)\\\\s*=\\\\s*require\\\\(([\'\\\"][^\'\"]+[\'\"])\\\\)"',
  '      "replace": string,    // replacement string, may use $1, $2, ... capture groups',
  '      "flags"?: string,      // optional, defaults to "g"',
  '      "language"?: "js"|"ts"|"jsx"|"tsx"|"json"|"css"|"html"|"md" // optional file filter',
  '    }',
  '  ],',
  '  "verification": {',
  '    "type": "regex-no-match"|"test-pass",',
  '    "target": string        // for regex-no-match: the regex source to check is gone; for test-pass: the test command (informational)',
  '  }',
  '}',
  '',
  'Rules:',
  '1. The "match" field MUST be a string that can be passed to `new RegExp(match, "g")` without throwing.',
  '2. Capture groups in "match" can be referenced as $1, $2, ... in "replace".',
  '3. Patterns are applied sequentially in the order given.',
  '4. If a language filter is provided, only apply that pattern to files whose extension matches.',
  '5. The verification.target for "regex-no-match" is a regex source that should NOT appear in the transformed code.',
  '6. Output ONLY the JSON object (or a single ```json fenced block). No prose before or after.',
].join('\n')

export interface BuiltPrompt {
  systemPrompt: string
  userPrompt: string
}

export function buildCodemodPrompt(description: string, sampleCode?: string): BuiltPrompt {
  const userPrompt = [
    `Migration request: ${description}`,
    '',
    sampleCode
      ? 'Sample input code (for context — inform the regex patterns):'
      : '(No sample code provided — generate a general-purpose codemod for this migration.)',
    sampleCode ? '```' : '',
    sampleCode ?? '',
    sampleCode ? '```' : '',
    '',
    'Produce the codemod JSON spec now.',
  ]
    .filter((line) => (line !== '' ? true : true))
    .join('\n')
  return { systemPrompt: SYSTEM_PROMPT, userPrompt }
}

/** Convenience: emit the JSON the prompt expects (used by tests, mock provider). */
export function codemodSpecToString(spec: CodemodSpec): string {
  return JSON.stringify(spec, null, 2)
}
