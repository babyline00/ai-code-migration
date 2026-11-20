/**
 * AI provider abstraction for the AI-Powered Code Migration Tool.
 *
 * Unlike the parent project's streaming chat provider, this module exposes a
 * non-streaming `complete()` that returns the full text of an LLM response.
 * The codemod-generation prompt expects a single JSON document (possibly
 * fenced in markdown), so streaming is not needed and a single completion is
 * both simpler to parse and to test.
 *
 * The `ChatProvider` interface is intentionally minimal so a `MockProvider`
 * can stand in for tests and offline development. `ZaiProvider` wraps the
 * `z-ai-web-dev-sdk` chat completion endpoint.
 */

export interface ChatProvider {
  /** Returns the full text of an LLM completion for the given prompt. */
  complete(args: {
    systemPrompt: string
    userPrompt: string
  }): Promise<string>
}

let cachedProvider: ChatProvider | null = null

class ZaiProvider implements ChatProvider {
  async complete(args: {
    systemPrompt: string
    userPrompt: string
  }): Promise<string> {
    const ZAI = (await import('z-ai-web-dev-sdk')).default
    const zai = await ZAI.create()
    const messages = [
      { role: 'system' as const, content: args.systemPrompt },
      { role: 'user' as const, content: args.userPrompt },
    ]
    const completion = await zai.chat.completions.create({
      messages,
      stream: false,
      thinking: { type: 'disabled' },
    })
    if (typeof completion === 'string') return completion
    const content = (completion as any)?.choices?.[0]?.message?.content
    if (typeof content === 'string') return content
    // Some SDK shapes return a body stream even when stream:false is requested —
    // drain it defensively.
    const body: ReadableStream<Uint8Array> | undefined =
      (completion as any)?.body ?? (completion as any)?._body
    if (body && typeof (body as any).getReader === 'function') {
      const reader = (body as ReadableStream<Uint8Array>).getReader()
      const decoder = new TextDecoder()
      let out = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        out += decoder.decode(value, { stream: true })
      }
      return out
    }
    return ''
  }
}

class MockProvider implements ChatProvider {
  async complete(args: { systemPrompt: string; userPrompt: string }): Promise<string> {
    // Deterministic mock used by tests and offline mode. The mock returns a
    // codemod spec for the canonical "CommonJS → ESM" example so the UI is
    // demoable without an LLM key. The `parseCodemodResponse` parser will
    // accept either fenced JSON or raw JSON.
    const isChecklistRequest = /checklist/i.test(args.systemPrompt)
    if (isChecklistRequest) {
      return [
        'Here is the manual checklist:',
        '```json',
        JSON.stringify([
          { id: 'step-1', text: 'Update package.json: set "type": "module"', done: false },
          { id: 'step-2', text: 'Rename .js entry files to .mjs if needed', done: false },
          { id: 'step-3', text: 'Audit dynamic require() calls — convert to import()', done: false },
        ], null, 2),
        '```',
      ].join('\n')
    }
    return [
      '```json',
      JSON.stringify({
        name: 'commonjs-to-esm',
        description: 'Convert CommonJS require()/module.exports to ES module import/export.',
        patterns: [
          {
            match: 'const\\s+(\\w+)\\s*=\\s*require\\([\'"]([^\'"]+)[\'"]\\)',
            replace: 'import $1 from \'$2\'',
            flags: 'g',
            language: 'ts',
          },
          {
            match: 'module\\.exports\\s*=\\s*(\\{[\\s\\S]*?\\})',
            replace: 'export default $1',
            flags: 'g',
            language: 'ts',
          },
        ],
        verification: {
          type: 'regex-no-match',
          target: 'require\\(',
        },
      }, null, 2),
      '```',
    ].join('\n')
  }
}

export function getChatProvider(): ChatProvider {
  if (cachedProvider) return cachedProvider
  if (process.env.PKC_DISABLE_LLM === '1') {
    cachedProvider = new MockProvider()
    return cachedProvider
  }
  try {
    cachedProvider = new ZaiProvider()
  } catch (e) {
    console.warn('[ai] ZaiProvider unavailable, using MockProvider:', (e as Error).message)
    cachedProvider = new MockProvider()
  }
  return cachedProvider
}

/** Test-only. */
export function __setChatProviderForTest(p: ChatProvider | null) {
  cachedProvider = p
}
