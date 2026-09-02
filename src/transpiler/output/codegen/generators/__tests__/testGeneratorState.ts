/**
 * Shared factory for IGeneratorState in generator tests.
 *
 * Twelve test files each defined their own `createMockState`, all spelling out
 * the same thirteen fields and differing only in the defaults for
 * `currentScope` and `inFunctionBody`. Adding a field to IGeneratorState meant
 * twelve edits, and PR #1281 paid the same tax on ICodeGenSymbols -- one new
 * field, ten mock literals.
 *
 * That matters beyond convenience here: #1285 changed `currentScope` from a
 * leaf-name string to a scope reference, and #1298 to a whole PATH. With twelve
 * copies each of those is twelve
 * places to get the migration right; with one it is one.
 */

import IGeneratorState from "../IGeneratorState";

/**
 * Static utility class for building generator state in tests.
 */
class TestGeneratorState {
  /**
   * A neutral IGeneratorState, with any field overridden.
   *
   * Defaults are the quiescent case -- file level, outside a function body,
   * nothing tracked. A test overrides only what it is actually about, so the
   * fields a test does NOT mention are visibly not part of what it asserts.
   */
  static create(overrides?: Partial<IGeneratorState>): IGeneratorState {
    return {
      currentScopePath: "",
      indentLevel: 0,
      inFunctionBody: false,
      currentParameters: new Map(),
      localVariables: new Set(),
      localArrays: new Set(),
      expectedType: null,
      selfIncludeAdded: false,
      scopeMembers: new Map(),
      mainArgsName: null,
      floatBitShadows: new Set(),
      floatShadowCurrent: new Set(),
      lengthCache: null,
      ...overrides,
    };
  }
}

export default TestGeneratorState;
