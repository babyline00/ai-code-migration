import { test, expect, describe } from 'bun:test'
import { verify } from '../verifier'
import type { VerificationSpec } from '../types'

describe('verify', () => {
  test('regex-no-match → ok when target gone', () => {
    const v: VerificationSpec = { type: 'regex-no-match', target: 'require\\(' }
    const result = verify("import fs from 'fs'", v)
    expect(result.ok).toBe(true)
    expect(result.reason).toContain('passed')
  })

  test('regex-no-match → not ok when target still present', () => {
    const v: VerificationSpec = { type: 'regex-no-match', target: 'require\\(' }
    const result = verify("const fs = require('fs')", v)
    expect(result.ok).toBe(false)
    expect(result.reason).toContain('Found remaining match')
  })

  test('regex-no-match → not ok when target missing', () => {
    const v: VerificationSpec = { type: 'regex-no-match' }
    const result = verify('any code', v)
    expect(result.ok).toBe(false)
    expect(result.reason).toContain('non-empty')
  })

  test('regex-no-match → not ok when target is empty string', () => {
    const v: VerificationSpec = { type: 'regex-no-match', target: '' }
    const result = verify('any code', v)
    expect(result.ok).toBe(false)
  })

  test('regex-no-match → not ok when target is an invalid regex', () => {
    const v: VerificationSpec = { type: 'regex-no-match', target: '(unbalanced' }
    const result = verify('any code', v)
    expect(result.ok).toBe(false)
    expect(result.reason).toContain('Invalid verification regex')
  })

  test('test-pass → stubbed ok', () => {
    const v: VerificationSpec = { type: 'test-pass', target: 'bun test path/to/test.ts' }
    const result = verify('any code', v)
    expect(result.ok).toBe(true)
    expect(result.reason.toLowerCase()).toContain('stub')
  })

  test('test-pass → ok even without a target', () => {
    const v: VerificationSpec = { type: 'test-pass' }
    const result = verify('any code', v)
    expect(result.ok).toBe(true)
  })

  test('unknown verification type → not ok', () => {
    const v = { type: 'magic' } as any as VerificationSpec
    const result = verify('any code', v)
    expect(result.ok).toBe(false)
    expect(result.reason).toContain('Unknown')
  })

  test('missing verification object → not ok', () => {
    const result = verify('any code', null as any as VerificationSpec)
    expect(result.ok).toBe(false)
  })

  test('regex with anchors — ^foo not at start → ok', () => {
    const v: VerificationSpec = { type: 'regex-no-match', target: '^foo' }
    const result = verify('not foo', v)
    expect(result.ok).toBe(true)
  })
})
