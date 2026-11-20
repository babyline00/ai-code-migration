/**
 * Unified-diff formatter.
 *
 * `formatDiff(original, transformed)` returns a unified-diff-style string
 * with the conventional prefixes:
 *   - ` ` (space) for unchanged context lines
 *   - `-` for lines only in `original`
 *   - `+` for lines only in `transformed`
 *
 * The implementation uses a textbook Longest Common Subsequence (LCS) over
 * line arrays to keep the algorithm dependency-free and easy to test. This
 * is the same shape `diff(1)` produces (without the @@ hunk headers — the
 * UI renders its own hunk decorations) and is what the preview panel shows
 * to the user before they click "Apply".
 *
 * Performance: O(n*m) on the number of lines. The MVP scope is single-file
 * snippets pasted into the UI, so the inputs are bounded and the simple
 * algorithm is appropriate. For very large files a future upgrade would
 * swap in `diff` (Myers' algorithm) or `diff-match-patch`.
 */

/** Split a string into lines, preserving the trailing-newline convention: a final
 *  line with no trailing newline still appears as its own line entry. */
export function splitLines(s: string): string[] {
  if (s.length === 0) return []
  // Keep the trailing empty line if the string ends with `\n`.
  const trailing = s.endsWith('\n')
  const lines = s.split('\n')
  if (trailing) lines.pop()
  return lines
}

function lcs(a: string[], b: string[]): number[][] {
  const n = a.length
  const m = b.length
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      if (a[i] === b[j]) {
        dp[i][j] = dp[i + 1][j + 1] + 1
      } else {
        dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1])
      }
    }
  }
  return dp
}

/** Walk the LCS table to produce a flat list of ops: kept | removed | added. */
function diffOps(a: string[], b: string[]): Array<{ op: 'keep' | 'rem' | 'add'; line: string }> {
  const dp = lcs(a, b)
  const ops: Array<{ op: 'keep' | 'rem' | 'add'; line: string }> = []
  let i = 0
  let j = 0
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      ops.push({ op: 'keep', line: a[i] })
      i++
      j++
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      ops.push({ op: 'rem', line: a[i] })
      i++
    } else {
      ops.push({ op: 'add', line: b[j] })
      j++
    }
  }
  while (i < a.length) {
    ops.push({ op: 'rem', line: a[i] })
    i++
  }
  while (j < b.length) {
    ops.push({ op: 'add', line: b[j] })
    j++
  }
  return ops
}

export function formatDiff(original: string, transformed: string): string {
  const a = splitLines(original)
  const b = splitLines(transformed)
  if (a.length === 0 && b.length === 0) return ''
  const ops = diffOps(a, b)
  return ops
    .map((op) => {
      if (op.op === 'keep') return ` ${op.line}`
      if (op.op === 'rem') return `-${op.line}`
      return `+${op.line}`
    })
    .join('\n')
}

/** Human-readable summary used in the preview UI: e.g. "+3 -2". */
export function diffSummary(original: string, transformed: string): { added: number; removed: number } {
  const ops = diffOps(splitLines(original), splitLines(transformed))
  let added = 0
  let removed = 0
  for (const op of ops) {
    if (op.op === 'add') added++
    else if (op.op === 'rem') removed++
  }
  return { added, removed }
}
