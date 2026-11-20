import { test, expect, describe } from 'bun:test'
import {
  getChatProvider,
  __setChatProviderForTest,
  type ChatProvider,
} from '../ai'
import { parseCodemodResponse } from '../codemod-parser'
import { parseChecklist } from '../checklist-builder'

describe('ChatProvider — MockProvider', () => {
  test('MockProvider.complete returns a valid codemod JSON for a codemod request', async () => {
    // Force mock provider for this test by setting PKC_DISABLE_LLM=1 logic via test override.
    class DeterministicMock implements ChatProvider {
      async complete(args: { systemPrompt: string; userPrompt: string }): Promise<string> {
        return [
          '```json',
          JSON.stringify({
            name: 'commonjs-to-esm',
            description: 'Convert CommonJS require() to ES module import.',
            patterns: [
              {
                match: "const\\s+(\\w+)\\s*=\\s*require\\(['\"]([^'\"]+)['\"]\\)",
                replace: "import $1 from '$2'",
                flags: 'g',
              },
            ],
            verification: { type: 'regex-no-match', target: 'require\\(' },
          }, null, 2),
          '```',
        ].join('\n')
      }
    }
    __setChatProviderForTest(new DeterministicMock())
    const provider = getChatProvider()
    const text = await provider.complete({
      systemPrompt: 'You produce a JSON codemod spec.',
      userPrompt: 'Convert CommonJS to ESM',
    })
    const spec = parseCodemodResponse(text)
    expect(spec).not.toBeNull()
    expect(spec!.name).toBe('commonjs-to-esm')
    expect(spec!.patterns).toHaveLength(1)
    expect(spec!.verification.type).toBe('regex-no-match')
    __setChatProviderForTest(null)
  })

  test('MockProvider.complete returns a parseable checklist for a checklist request', async () => {
    class ChecklistMock implements ChatProvider {
      async complete(args: { systemPrompt: string; userPrompt: string }): Promise<string> {
        return [
          '- [ ] Update package.json: set "type": "module"',
          '- [ ] Audit dynamic require() calls',
          '- [x] Rename entry files',
        ].join('\n')
      }
    }
    __setChatProviderForTest(new ChecklistMock())
    const provider = getChatProvider()
    const text = await provider.complete({
      systemPrompt: 'You produce a markdown checklist.',
      userPrompt: 'Plan the migration',
    })
    const items = parseChecklist(text)
    expect(items).toHaveLength(3)
    expect(items[0].text).toContain('package.json')
    expect(items[2].done).toBe(true)
    __setChatProviderForTest(null)
  })

  test('getChatProvider returns the same instance across calls (cached)', () => {
    __setChatProviderForTest(null)
    const a = getChatProvider()
    const b = getChatProvider()
    expect(a).toBe(b)
    __setChatProviderForTest(null)
  })

  test('PKC_DISABLE_LLM=1 forces the mock provider deterministically', async () => {
    __setChatProviderForTest(null)
    process.env.PKC_DISABLE_LLM = '1'
    const provider = getChatProvider()
    const text = await provider.complete({
      systemPrompt: 'You produce a JSON codemod spec.',
      userPrompt: 'Convert CommonJS to ESM',
    })
    const spec = parseCodemodResponse(text)
    expect(spec).not.toBeNull()
    expect(spec!.name).toBe('commonjs-to-esm')
    delete process.env.PKC_DISABLE_LLM
    __setChatProviderForTest(null)
  })

  test('clearing the cached provider causes a new instance on next call', () => {
    __setChatProviderForTest(null)
    const a = getChatProvider()
    __setChatProviderForTest(null)
    const b = getChatProvider()
    expect(a).not.toBe(b)
    __setChatProviderForTest(null)
  })
})
