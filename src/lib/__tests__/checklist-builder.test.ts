import { test, expect, describe } from 'bun:test'
import { parseChecklist, serializeChecklist, toggleChecklistItem } from '../checklist-builder'

describe('parseChecklist', () => {
  test('parses markdown unchecked boxes', () => {
    const md = '- [ ] Update package.json\n- [ ] Rename .js files to .mjs'
    const items = parseChecklist(md)
    expect(items).toHaveLength(2)
    expect(items[0].id).toBe('step-1')
    expect(items[0].text).toBe('Update package.json')
    expect(items[0].done).toBe(false)
    expect(items[1].id).toBe('step-2')
  })

  test('parses markdown checked boxes', () => {
    const md = '- [x] Done task'
    const items = parseChecklist(md)
    expect(items[0].done).toBe(true)
  })

  test('parses upper-case [X] as done', () => {
    const items = parseChecklist('- [X] upper case')
    expect(items[0].done).toBe(true)
  })

  test('parses numbered list as unchecked items', () => {
    const md = '1. First step\n2. Second step'
    const items = parseChecklist(md)
    expect(items).toHaveLength(2)
    expect(items[0].text).toBe('First step')
    expect(items[0].done).toBe(false)
    expect(items[1].id).toBe('step-2')
  })

  test('parses plain dash list', () => {
    const md = '- one\n- two'
    const items = parseChecklist(md)
    expect(items).toHaveLength(2)
    expect(items[0].text).toBe('one')
  })

  test('handles indented items', () => {
    const md = '  - [ ] indented item'
    const items = parseChecklist(md)
    expect(items).toHaveLength(1)
    expect(items[0].text).toBe('indented item')
  })

  test('skips blank lines and non-list text', () => {
    const md = [
      'Here is your checklist:',
      '',
      '- [ ] one',
      '',
      'Some commentary that should be ignored.',
      '- [ ] two',
    ].join('\n')
    const items = parseChecklist(md)
    expect(items).toHaveLength(2)
  })

  test('returns [] for empty input', () => {
    expect(parseChecklist('')).toEqual([])
  })

  test('returns [] for non-string input', () => {
    expect(parseChecklist(null as any)).toEqual([])
  })

  test('skips checkboxes with empty text', () => {
    expect(parseChecklist('- [ ]')).toEqual([])
    expect(parseChecklist('- [x]   ')).toEqual([])
  })

  test('parses a mix of checked and unchecked items', () => {
    const md = '- [x] done\n- [ ] not done\n- [x] also done'
    const items = parseChecklist(md)
    expect(items.map((i) => i.done)).toEqual([true, false, true])
  })
})

describe('serializeChecklist + toggleChecklistItem', () => {
  test('serialize round-trips back to markdown', () => {
    const items = parseChecklist('- [ ] one\n- [x] two')
    const md = serializeChecklist(items)
    expect(md).toContain('- [ ] one')
    expect(md).toContain('- [x] two')
  })

  test('toggleChecklistItem flips the done flag immutably', () => {
    const items = parseChecklist('- [ ] one\n- [ ] two')
    const next = toggleChecklistItem(items, 'step-1')
    expect(next[0].done).toBe(true)
    // Original is unchanged.
    expect(items[0].done).toBe(false)
  })

  test('toggleChecklistItem on unknown id returns the same array shape', () => {
    const items = parseChecklist('- [ ] one')
    const next = toggleChecklistItem(items, 'nope')
    expect(next).toHaveLength(1)
    expect(next[0].done).toBe(false)
  })
})
