import { test, expect, describe } from 'bun:test'
import { formatDiff, diffSummary, splitLines } from '../diff-formatter'

describe('formatDiff', () => {
  test('additions prefixed with +', () => {
    const diff = formatDiff('a\nb', 'a\nb\nc')
    const lines = diff.split('\n')
    expect(lines.some((l) => l.startsWith('+c'))).toBe(true)
    expect(lines.some((l) => l === ' a')).toBe(true)
  })

  test('deletions prefixed with -', () => {
    const diff = formatDiff('a\nb\nc', 'a\nb')
    const lines = diff.split('\n')
    expect(lines.some((l) => l === '-c')).toBe(true)
  })

  test('unchanged lines prefixed with space', () => {
    const diff = formatDiff('a\nb', 'a\nb')
    const lines = diff.split('\n')
    expect(lines).toEqual([' a', ' b'])
  })

  test('mixed additions and deletions', () => {
    const diff = formatDiff('a\nb\nc', 'a\nx\nc')
    const lines = diff.split('\n')
    expect(lines).toContain(' a')
    expect(lines).toContain('-b')
    expect(lines).toContain('+x')
    expect(lines).toContain(' c')
  })

  test('identical inputs → all context lines', () => {
    const diff = formatDiff('foo\nbar', 'foo\nbar')
    expect(diff).toBe(' foo\n bar')
  })

  test('empty inputs → empty diff', () => {
    expect(formatDiff('', '')).toBe('')
  })

  test('pure addition → all + lines', () => {
    const diff = formatDiff('', 'a\nb')
    expect(diff).toBe('+a\n+b')
  })

  test('pure deletion → all - lines', () => {
    const diff = formatDiff('a\nb', '')
    expect(diff).toBe('-a\n-b')
  })

  test('preserves whitespace inside lines', () => {
    const diff = formatDiff('  indented', '  indented\n  more')
    const lines = diff.split('\n')
    expect(lines.some((l) => l === '   indented')).toBe(true)
    expect(lines.some((l) => l === '+  more')).toBe(true)
  })

  test('trailing newline handling — final empty line is not a phantom', () => {
    // "a\n" splits to ["a"] (trailing newline drops the empty entry)
    expect(splitLines('a\n')).toEqual(['a'])
    expect(splitLines('a\nb\n')).toEqual(['a', 'b'])
    expect(splitLines('a\nb')).toEqual(['a', 'b'])
    expect(splitLines('')).toEqual([])
  })
})

describe('diffSummary', () => {
  test('counts added + removed', () => {
    const s = diffSummary('a\nb\nc', 'a\nx\nc')
    expect(s.added).toBe(1)
    expect(s.removed).toBe(1)
  })
  test('identical inputs → 0 added, 0 removed', () => {
    const s = diffSummary('a\nb', 'a\nb')
    expect(s).toEqual({ added: 0, removed: 0 })
  })
  test('pure addition → only added', () => {
    const s = diffSummary('a', 'a\nb')
    expect(s).toEqual({ added: 1, removed: 0 })
  })
  test('pure removal → only removed', () => {
    const s = diffSummary('a\nb', 'a')
    expect(s).toEqual({ added: 0, removed: 1 })
  })
})
