/**
 * Codemod applier — regex-based transformation engine.
 *
 * `applyCodemod(code, codemod, filePath?)` walks each `Pattern` in the spec
 * sequentially and runs `String.prototype.replace(new RegExp(match, flags),
 * replace)` on the code. Each pattern's `match` regex defaults to the
 * global flag, but the spec can override via `pattern.flags`. If a
 * `language` filter is set on the pattern, the pattern is skipped unless
 * the file's extension matches the language.
 *
 * The function is pure: it does not mutate its inputs or touch disk. The
 * caller decides whether to persist the resulting `newCode`.
 *
 * Returns `{ newCode, matchCount, replacements }` where `matchCount` is the
 * total number of regex matches across all patterns and `replacements` is
 * the total number of substrings actually substituted (always equal to
 * `matchCount` for global regexes — exposed separately so the UI can show
 * both numbers and so a future "dry-run with rejections" feature can plug
 * in here).
 */

import type { CodemodSpec, Language, Pattern } from './types'

/** Map a file path to a `Language` enum, or `null` if the extension is unknown. */
export function languageOfFilePath(filePath: string | undefined): Language | null {
  if (!filePath) return null
  const m = /\.([a-z0-9]+)$/i.exec(filePath)
  if (!m) return null
  const ext = m[1].toLowerCase()
  const map: Record<string, Language> = {
    js: 'js',
    mjs: 'js',
    cjs: 'js',
    ts: 'ts',
    mts: 'ts',
    cts: 'ts',
    jsx: 'jsx',
    tsx: 'tsx',
    json: 'json',
    css: 'css',
    scss: 'css',
    html: 'html',
    htm: 'html',
    md: 'md',
    markdown: 'md',
  }
  return map[ext] ?? null
}

/** Whether a pattern should run for the given file path, given its optional language filter. */
function patternApplies(pattern: Pattern, fileLang: Language | null): boolean {
  if (!pattern.language) return true
  if (fileLang === null) return true // no path supplied — apply unconditionally
  return pattern.language === fileLang
}

/** Count global regex matches without mutating. */
function countMatches(re: RegExp, code: string): number {
  // `String.prototype.matchAll` requires the global flag.
  if (!re.global) {
    return code.match(re) ? 1 : 0
  }
  let n = 0
  for (const _ of code.matchAll(re)) n++
  return n
}

export function applyCodemod(
  code: string,
  codemod: CodemodSpec,
  filePath?: string,
): { newCode: string; matchCount: number; replacements: number } {
  if (typeof code !== 'string') {
    throw new TypeError('applyCodemod: code must be a string')
  }
  if (!codemod || !Array.isArray(codemod.patterns)) {
    throw new TypeError('applyCodemod: codemod.patterns must be an array')
  }

  let current = code
  let matchCount = 0
  let replacements = 0
  const fileLang = languageOfFilePath(filePath)

  for (const pattern of codemod.patterns) {
    if (!patternApplies(pattern, fileLang)) continue
    const flags = pattern.flags && pattern.flags.length > 0 ? pattern.flags : 'g'
    // Always force the global flag for matching accounting.
    const finalFlags = flags.includes('g') ? flags : flags + 'g'
    let re: RegExp
    try {
      re = new RegExp(pattern.match, finalFlags)
    } catch {
      // Invalid regex — skip the pattern.
      continue
    }
    const matches = countMatches(re, current)
    if (matches === 0) continue
    const before = current
    const after = current.replace(re, pattern.replace)
    if (after !== before) {
      current = after
      matchCount += matches
      replacements += matches
    }
  }

  return { newCode: current, matchCount, replacements }
}
