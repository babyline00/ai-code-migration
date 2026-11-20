/**
 * Codemod response parser.
 *
 * The LLM is asked to return a single JSON object (optionally wrapped in a
 * ```json fenced block, optionally surrounded by prose). `parseCodemodResponse`
 * extracts and structurally validates the JSON, returning a `CodemodSpec` or
 * `null` if no valid spec could be found.
 *
 * The parser is intentionally lenient about whitespace and fence markers but
 * strict about the schema:
 *  - `name`, `description` must be non-empty strings
 *  - `patterns` must be an array of objects each with a non-empty `match`
 *    string and a string `replace`
 *  - `verification` must be an object with `type` ∈ {'regex-no-match','test-pass'}
 *
 * Notes:
 *  - Malformed JSON returns `null` (no throw).
 *  - If multiple JSON blocks are present, the first one that validates wins.
 */

import type { CodemodSpec, Language, Pattern, VerificationSpec } from './types'

const LANGUAGES: Language[] = ['js', 'ts', 'jsx', 'tsx', 'json', 'css', 'html', 'md']

function isValidPattern(p: any): p is Pattern {
  if (!p || typeof p !== 'object') return false
  if (typeof p.match !== 'string' || p.match.length === 0) return false
  if (typeof p.replace !== 'string') return false
  if (p.flags !== undefined && typeof p.flags !== 'string') return false
  if (p.language !== undefined && !LANGUAGES.includes(p.language)) return false
  // Validate the regex source compiles.
  try {
    // eslint-disable-next-line no-new
    new RegExp(p.match, p.flags ?? 'g')
  } catch {
    return false
  }
  return true
}

function isValidVerification(v: any): v is VerificationSpec {
  if (!v || typeof v !== 'object') return false
  if (v.type !== 'regex-no-match' && v.type !== 'test-pass') return false
  if (v.target !== undefined && typeof v.target !== 'string') return false
  if (v.type === 'regex-no-match') {
    if (typeof v.target !== 'string' || v.target.length === 0) return false
    try {
      // eslint-disable-next-line no-new
      new RegExp(v.target)
    } catch {
      return false
    }
  }
  return true
}

function coerceSpec(obj: any): CodemodSpec | null {
  if (!obj || typeof obj !== 'object') return null
  if (typeof obj.name !== 'string' || obj.name.trim().length === 0) return null
  if (typeof obj.description !== 'string' || obj.description.trim().length === 0) return null
  if (!Array.isArray(obj.patterns) || obj.patterns.length === 0) return null
  const patterns: Pattern[] = []
  for (const p of obj.patterns) {
    if (!isValidPattern(p)) return null
    patterns.push({
      match: p.match,
      replace: p.replace,
      flags: p.flags,
      language: p.language,
    })
  }
  if (!isValidVerification(obj.verification)) return null
  return {
    name: obj.name,
    description: obj.description,
    patterns,
    verification: {
      type: obj.verification.type,
      target: obj.verification.target,
    },
  }
}

/** Extract every ```json fenced block (or generic ``` block) from the text. */
function extractFencedBlocks(text: string): string[] {
  const blocks: string[] = []
  const fenceRe = /```(?:json)?\s*([\s\S]*?)```/gi
  let m: RegExpExecArray | null
  while ((m = fenceRe.exec(text)) !== null) {
    blocks.push(m[1])
  }
  return blocks
}

/**
 * Find the largest balanced {...} JSON object in `s` starting at or after
 * index `start`. Returns the slice or null if none found. Used as a fallback
 * when no fenced block is present and the LLM has wrapped the JSON in prose.
 */
function findBalancedJsonObject(s: string, start = 0): string | null {
  const firstBrace = s.indexOf('{', start)
  if (firstBrace === -1) return null
  let depth = 0
  let inString = false
  let escaped = false
  for (let i = firstBrace; i < s.length; i++) {
    const ch = s[i]
    if (escaped) {
      escaped = false
      continue
    }
    if (ch === '\\' && inString) {
      escaped = true
      continue
    }
    if (ch === '"') {
      inString = !inString
      continue
    }
    if (inString) continue
    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) return s.slice(firstBrace, i + 1)
    }
  }
  return null
}

function tryParse(s: string): CodemodSpec | null {
  try {
    const obj = JSON.parse(s)
    return coerceSpec(obj)
  } catch {
    return null
  }
}

export function parseCodemodResponse(text: string): CodemodSpec | null {
  if (typeof text !== 'string' || text.length === 0) return null

  // 1) Try fenced ```json blocks first (the most common LLM output shape).
  for (const block of extractFencedBlocks(text)) {
    const spec = tryParse(block)
    if (spec) return spec
  }

  // 2) Fallback: find a balanced JSON object anywhere in the text.
  let cursor = 0
  while (cursor < text.length) {
    const candidate = findBalancedJsonObject(text, cursor)
    if (candidate === null) break
    const spec = tryParse(candidate)
    if (spec) return spec
    cursor = text.indexOf('{', cursor) + 1
    if (cursor === 0) break
  }

  return null
}
