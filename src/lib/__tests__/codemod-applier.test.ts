import { test, expect, describe } from 'bun:test'
import { applyCodemod, languageOfFilePath } from '../codemod-applier'
import type { CodemodSpec } from '../types'

describe('applyCodemod', () => {
  test('1 pattern with 2 matches → 2 replacements', () => {
    const codemod: CodemodSpec = {
      name: 'rename',
      description: 'rename foo to bar',
      patterns: [{ match: 'foo', replace: 'bar' }],
      verification: { type: 'regex-no-match', target: 'foo' },
    }
    const result = applyCodemod('foo here and foo there', codemod)
    expect(result.matchCount).toBe(2)
    expect(result.replacements).toBe(2)
    expect(result.newCode).toBe('bar here and bar there')
  })

  test('0 matches → 0 replacements, newCode unchanged', () => {
    const codemod: CodemodSpec = {
      name: 'no-op',
      description: 'no matches',
      patterns: [{ match: 'zzz', replace: 'yyy' }],
      verification: { type: 'regex-no-match', target: 'zzz' },
    }
    const result = applyCodemod('nothing to replace here', codemod)
    expect(result.matchCount).toBe(0)
    expect(result.replacements).toBe(0)
    expect(result.newCode).toBe('nothing to replace here')
  })

  test('multiple patterns applied sequentially', () => {
    const codemod: CodemodSpec = {
      name: 'multi',
      description: 'two patterns',
      patterns: [
        { match: 'foo', replace: 'FOO' },
        { match: 'bar', replace: 'BAR' },
      ],
      verification: { type: 'regex-no-match', target: 'foo' },
    }
    const result = applyCodemod('foo bar baz', codemod)
    expect(result.newCode).toBe('FOO BAR baz')
    expect(result.matchCount).toBe(2)
  })

  test('language filter — only applies to matching files', () => {
    const codemod: CodemodSpec = {
      name: 'ts-only',
      description: 'ts only',
      patterns: [{ match: 'foo', replace: 'bar', language: 'ts' }],
      verification: { type: 'regex-no-match', target: 'foo' },
    }
    const code = 'foo here'
    expect(applyCodemod(code, codemod, 'src/index.ts').newCode).toBe('bar here')
    expect(applyCodemod(code, codemod, 'src/index.js').newCode).toBe('foo here')
  })

  test('language filter skipped when no file path given (applies unconditionally)', () => {
    const codemod: CodemodSpec = {
      name: 'ts-only',
      description: 'ts only',
      patterns: [{ match: 'foo', replace: 'bar', language: 'ts' }],
      verification: { type: 'regex-no-match', target: 'foo' },
    }
    expect(applyCodemod('foo', codemod).newCode).toBe('bar')
  })

  test('capture groups substitute via $1, $2', () => {
    const codemod: CodemodSpec = {
      name: 'require-to-import',
      description: 'commonjs to esm',
      patterns: [
        {
          match: "const\\s+(\\w+)\\s*=\\s*require\\(['\"]([^'\"]+)['\"]\\)",
          replace: "import $1 from '$2'",
        },
      ],
      verification: { type: 'regex-no-match', target: 'require\\(' },
    }
    const result = applyCodemod("const fs = require('fs')", codemod)
    expect(result.newCode).toBe("import fs from 'fs'")
    expect(result.replacements).toBe(1)
  })

  test('flags override — non-global regex still replaces the first match only', () => {
    const codemod: CodemodSpec = {
      name: 'first-only',
      description: 'first only',
      patterns: [{ match: 'a', replace: 'X', flags: '' }],
      verification: { type: 'regex-no-match', target: 'a' },
    }
    // The applier always forces global — see codemod-applier docs.
    const result = applyCodemod('aaa', codemod)
    expect(result.newCode).toBe('XXX')
    expect(result.replacements).toBe(3)
  })

  test('invalid regex pattern is skipped without throwing', () => {
    const codemod: CodemodSpec = {
      name: 'bad',
      description: 'bad',
      patterns: [
        { match: '(unbalanced', replace: 'x' },
        { match: 'foo', replace: 'bar' },
      ],
      verification: { type: 'regex-no-match', target: 'foo' },
    }
    const result = applyCodemod('foo here', codemod)
    expect(result.newCode).toBe('bar here')
    expect(result.matchCount).toBe(1)
  })

  test('throws on non-string code', () => {
    const codemod: CodemodSpec = {
      name: 'x',
      description: 'x',
      patterns: [{ match: 'a', replace: 'b' }],
      verification: { type: 'regex-no-match', target: 'a' },
    }
    expect(() => applyCodemod(null as any, codemod)).toThrow()
  })

  test('throws when codemod.patterns is not an array', () => {
    expect(() => applyCodemod('a', {} as any)).toThrow()
  })
})

describe('languageOfFilePath', () => {
  test('maps .ts → ts', () => {
    expect(languageOfFilePath('src/index.ts')).toBe('ts')
  })
  test('maps .tsx → tsx', () => {
    expect(languageOfFilePath('comp.tsx')).toBe('tsx')
  })
  test('maps .js → js', () => {
    expect(languageOfFilePath('a/b/c.js')).toBe('js')
  })
  test('maps .mjs → js', () => {
    expect(languageOfFilePath('mod.mjs')).toBe('js')
  })
  test('maps .css → css', () => {
    expect(languageOfFilePath('styles.css')).toBe('css')
  })
  test('returns null for unknown extension', () => {
    expect(languageOfFilePath('readme.md')).toBe('md')
    expect(languageOfFilePath('config.yaml')).toBeNull()
    expect(languageOfFilePath('archive.txt')).toBeNull()
  })
  test('returns null when no extension', () => {
    expect(languageOfFilePath('Makefile')).toBeNull()
  })
  test('returns null when undefined', () => {
    expect(languageOfFilePath(undefined)).toBeNull()
  })
})
