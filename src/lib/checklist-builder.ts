/**
 * Checklist builder — parses a markdown-style checklist emitted by the LLM
 * into the canonical `ChecklistItem[]` shape persisted in
 * `Migration.checklist`.
 *
 * Supported source formats:
 *   - Markdown checkboxes: `- [ ] task` or `* [x] task` (any indentation).
 *   - Numbered markdown: `1. task` (no checkbox — defaults to `done:false`).
 *   - Plain list: `- task` (defaults to `done:false`).
 *
 * Each parsed line gets a stable `id` of the form `step-{n}` so the UI can
 * toggle `done` without losing its place.
 */

import type { ChecklistItem } from './types'

interface RawEntry {
  text: string
  done: boolean
}

function parseLine(line: string): RawEntry | null {
  // Strip leading whitespace.
  const trimmed = line.replace(/^\s+/, '')
  if (trimmed.length === 0) return null

  // 1) Markdown checkbox:  - [ ] task  /  - [x] task  /  * [X] task
  //    The trailing text is OPTIONAL — `- [ ]` (no text) is a checkbox with
  //    an empty body, which we reject explicitly so the dash list regex
  //    below doesn't pick it up as text "[ ]".
  const checkboxRe = /^[-*+]\s+\[([ xX])\]\s*(.*)$/
  const cb = checkboxRe.exec(trimmed)
  if (cb) {
    const done = cb[1].toLowerCase() === 'x'
    const text = cb[2].trim()
    if (text.length === 0) return null
    return { text, done }
  }

  // 2) Numbered list:  1. task  /  1) task
  const numberedRe = /^\d+[.)]\s+(.*)$/
  const nb = numberedRe.exec(trimmed)
  if (nb) {
    const text = nb[1].trim()
    if (text.length === 0) return null
    return { text, done: false }
  }

  // 3) Plain dash list:  - task
  const dashRe = /^[-*+]\s+(.*)$/
  const db = dashRe.exec(trimmed)
  if (db) {
    const text = db[1].trim()
    if (text.length === 0) return null
    return { text, done: false }
  }

  return null
}

export function parseChecklist(text: string): ChecklistItem[] {
  if (typeof text !== 'string' || text.length === 0) return []
  const lines = text.split('\n')
  const items: ChecklistItem[] = []
  let i = 1
  for (const line of lines) {
    const parsed = parseLine(line)
    if (!parsed) continue
    items.push({ id: `step-${i}`, text: parsed.text, done: parsed.done })
    i++
  }
  return items
}

/** Convenience: render a `ChecklistItem[]` back into markdown. */
export function serializeChecklist(items: ChecklistItem[]): string {
  return items.map((it) => `- [${it.done ? 'x' : ' '}] ${it.text}`).join('\n')
}

/** Toggle a single item's `done` state. Returns a new array (immutable). */
export function toggleChecklistItem(items: ChecklistItem[], id: string): ChecklistItem[] {
  return items.map((it) => (it.id === id ? { ...it, done: !it.done } : it))
}
