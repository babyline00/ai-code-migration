import { test, expect, describe } from 'bun:test'
import { parseCodemodResponse } from '../codemod-parser'

describe('parseCodemodResponse', () => {
  const validSpec = {
    name: 'commonjs-to-esm',
    description: 'Convert CommonJS require() to ESM import.',
    patterns: [
      {
        match: 'const\\s+(\\w+)\\s*=\\s*require\\([\'"]([^\'"]+)[\'"]\\)',
        replace: "import $1 from '$2'",
      },
    ],
    verification: { type: 'regex-no-match' as const, target: 'require\\(' },
  }

  test('parses clean JSON', () => {
    const text = JSON.stringify(validSpec)
    const parsed = parseCodemodResponse(text)
    expect(parsed).not.toBeNull()
    expect(parsed!.name).toBe('commonjs-to-esm')
    expect(parsed!.patterns).toHaveLength(1)
    expect(parsed!.verification.type).toBe('regex-no-match')
  })

  test('parses fenced ```json block', () => {
    const text = ['Here is your spec:', '```json', JSON.stringify(validSpec), '```'].join('\n')
    const parsed = parseCodemodResponse(text)
    expect(parsed).not.toBeNull()
    expect(parsed!.name).toBe('commonjs-to-esm')
  })

  test('parses fenced plain ``` block', () => {
    const text = ['```', JSON.stringify(validSpec), '```'].join('\n')
    const parsed = parseCodemodResponse(text)
    expect(parsed).not.toBeNull()
  })

  test('parses prose-wrapped JSON (no fence)', () => {
    const text = `Sure! Here you go: ${JSON.stringify(validSpec)} Let me know if you need anything else.`
    const parsed = parseCodemodResponse(text)
    expect(parsed).not.toBeNull()
    expect(parsed!.name).toBe('commonjs-to-esm')
  })

  test('returns null for malformed JSON', () => {
    expect(parseCodemodResponse('{ this is not json')).toBeNull()
  })

  test('returns null for empty input', () => {
    expect(parseCodemodResponse('')).toBeNull()
  })

  test('returns null when patterns array is missing', () => {
    const noPatterns = { ...validSpec, patterns: [] }
    expect(parseCodemodResponse(JSON.stringify(noPatterns))).toBeNull()
  })

  test('returns null when verification.type is unknown', () => {
    const badVerification = {
      ...validSpec,
      verification: { type: 'magic', target: 'x' },
    }
    expect(parseCodemodResponse(JSON.stringify(badVerification))).toBeNull()
  })

  test('returns null when verification.target is missing for regex-no-match', () => {
    const badVerification = {
      ...validSpec,
      verification: { type: 'regex-no-match' },
    }
    expect(parseCodemodResponse(JSON.stringify(badVerification))).toBeNull()
  })

  test('returns null when pattern.match is invalid regex', () => {
    const badRegex = {
      ...validSpec,
      patterns: [{ match: '(unbalanced', replace: 'x' }],
    }
    expect(parseCodemodResponse(JSON.stringify(badRegex))).toBeNull()
  })

  test('returns null when name is empty', () => {
    const noName = { ...validSpec, name: '' }
    expect(parseCodemodResponse(JSON.stringify(noName))).toBeNull()
  })

  test('accepts a spec with a language filter on a pattern', () => {
    const withLang = {
      ...validSpec,
      patterns: [{ match: 'a', replace: 'b', language: 'ts' }],
    }
    const parsed = parseCodemodResponse(JSON.stringify(withLang))
    expect(parsed).not.toBeNull()
    expect(parsed!.patterns[0].language).toBe('ts')
  })

  test('rejects a spec with an invalid language filter', () => {
    const badLang = {
      ...validSpec,
      patterns: [{ match: 'a', replace: 'b', language: 'python' }],
    }
    expect(parseCodemodResponse(JSON.stringify(badLang))).toBeNull()
  })

  test('takes the first valid JSON block when several are present', () => {
    const text = [
      '```json',
      JSON.stringify({ ...validSpec, name: 'first' }),
      '```',
      '```json',
      JSON.stringify({ ...validSpec, name: 'second' }),
      '```',
    ].join('\n')
    const parsed = parseCodemodResponse(text)
    expect(parsed!.name).toBe('first')
  })
})
