import { test, expect, describe } from 'bun:test'
import { buildCodemodPrompt, codemodSpecToString } from '../codemod-builder'
import type { CodemodSpec } from '../types'

describe('buildCodemodPrompt', () => {
  test('system prompt asks the LLM for a JSON codemod spec', () => {
    const { systemPrompt } = buildCodemodPrompt('Convert CommonJS require() to ESM import')
    expect(systemPrompt).toContain('JSON')
    expect(systemPrompt).toContain('name')
    expect(systemPrompt).toContain('patterns')
    expect(systemPrompt).toContain('verification')
    expect(systemPrompt.toLowerCase()).toContain('codemod')
  })

  test('user prompt includes the migration description verbatim', () => {
    const { userPrompt } = buildCodemodPrompt('Rename componentWillMount to componentDidMount')
    expect(userPrompt).toContain('Rename componentWillMount to componentDidMount')
  })

  test('user prompt includes sample code when provided', () => {
    const sample = "const fs = require('fs');"
    const { userPrompt } = buildCodemodPrompt('CommonJS to ESM', sample)
    expect(userPrompt).toContain(sample)
    expect(userPrompt).toContain('Sample input code')
  })

  test('user prompt notes no sample when omitted', () => {
    const { userPrompt } = buildCodemodPrompt('Replace moment.js with date-fns')
    expect(userPrompt).toContain('No sample code')
  })

  test('system prompt specifies the JSON shape with match + replace fields', () => {
    const { systemPrompt } = buildCodemodPrompt('test')
    expect(systemPrompt).toContain('"match"')
    expect(systemPrompt).toContain('"replace"')
  })

  test('system prompt mentions the two verification types', () => {
    const { systemPrompt } = buildCodemodPrompt('test')
    expect(systemPrompt).toContain('regex-no-match')
    expect(systemPrompt).toContain('test-pass')
  })

  test('codemodSpecToString round-trips a spec through JSON', () => {
    const spec: CodemodSpec = {
      name: 'demo',
      description: 'demo spec',
      patterns: [{ match: 'a', replace: 'b' }],
      verification: { type: 'regex-no-match', target: 'a' },
    }
    const s = codemodSpecToString(spec)
    const parsed = JSON.parse(s)
    expect(parsed.name).toBe('demo')
    expect(parsed.patterns).toHaveLength(1)
    expect(parsed.verification.type).toBe('regex-no-match')
  })
})
