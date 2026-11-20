/**
 * Verifier — runs the `VerificationSpec` against a piece of transformed code.
 *
 * Two verification types are supported:
 *
 *  - `regex-no-match`: assert that `target` (a regex source) does NOT appear
 *    in the code. If it does, the verification fails. This is the primary
 *    MVP mechanism — e.g. after "CommonJS → ESM" the spec may ask the
 *    verifier to confirm that `require(` no longer appears in the code.
 *
 *  - `test-pass`: for the MVP this is a stub that returns `{ ok: true }`.
 *    Real test execution (`bun test path/to/test.ts` or `jest`) is a stretch
 *    goal and is intentionally NOT implemented in the MVP — running arbitrary
 *    shell commands from a Next.js route handler is unsafe without a
 *    sandbox. The stub returns a deterministic `ok: true` so the UI flow
 *    stays demoable; the field `reason` explains the stub.
 */

import type { VerifyResult, VerificationSpec } from './types'

export function verify(code: string, verification: VerificationSpec): VerifyResult {
  if (!verification || typeof verification !== 'object') {
    return { ok: false, reason: 'Missing verification spec.' }
  }
  if (verification.type === 'regex-no-match') {
    if (typeof verification.target !== 'string' || verification.target.length === 0) {
      return { ok: false, reason: 'regex-no-match requires a non-empty "target" regex.' }
    }
    let re: RegExp
    try {
      re = new RegExp(verification.target)
    } catch (e) {
      return { ok: false, reason: `Invalid verification regex: ${(e as Error).message}` }
    }
    if (re.test(code)) {
      return {
        ok: false,
        reason: `Found remaining match for /${verification.target}/ in transformed code.`,
      }
    }
    return { ok: true, reason: `No match for /${verification.target}/ — verification passed.` }
  }
  if (verification.type === 'test-pass') {
    // STUB — see module docs. Replace with a sandboxed shell executor for a
    // production build.
    return {
      ok: true,
      reason: `test-pass is stubbed for MVP (target="${verification.target ?? ''}"). Real test execution is a stretch goal.`,
    }
  }
  return { ok: false, reason: `Unknown verification type: ${(verification as any).type}` }
}
