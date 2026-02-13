/**
 * Test utilities for symbol collector tests.
 *
 * Provides mock IScopeSymbol instances for testing collectors
 * that now require proper scope references.
 */

import ESourceLanguage from "../../../../../utils/types/ESourceLanguage";
import IScopeSymbol from "../../../../types/symbols/IScopeSymbol";

/** Cached global scope for reuse */
let cachedGlobalScope: IScopeSymbol | null = null;

/**
 * Static utility class for creating mock scopes in tests.
 */
class TestScopeUtils {
  /**
   * Create the global scope singleton for tests.
   * The global scope has a self-reference for parent.
   */
  static createMockGlobalScope(): IScopeSymbol {
    const global: IScopeSymbol = {
      kind: "scope",
      name: "",
      parent: null as unknown as IScopeSymbol,
      scope: null as unknown as IScopeSymbol,
      members: [],
      functions: [],
      variables: [],
      memberVisibility: new Map(),
      sourceFile: "",
      sourceLine: 0,
      sourceLanguage: ESourceLanguage.CNext,
      isExported: true,
    };
    (global as unknown as { parent: IScopeSymbol }).parent = global;
    (global as unknown as { scope: IScopeSymbol }).scope = global;
    return global;
  }

  /**
   * Create a named scope for tests.
   */
  static createMockScope(name: string, parent?: IScopeSymbol): IScopeSymbol {
    const actualParent = parent ?? TestScopeUtils.createMockGlobalScope();
    return {
      kind: "scope",
      name,
      parent: actualParent,
      scope: actualParent,
      members: [],
      functions: [],
      variables: [],
      memberVisibility: new Map(),
      sourceFile: "",
      sourceLine: 0,
      sourceLanguage: ESourceLanguage.CNext,
      isExported: true,
    };
  }

  /**
   * Get the global scope singleton (cached for efficiency).
   */
  static getGlobalScope(): IScopeSymbol {
    if (!cachedGlobalScope) {
      cachedGlobalScope = TestScopeUtils.createMockGlobalScope();
    }
    return cachedGlobalScope;
  }

  /**
   * Reset the cached global scope (call before each test if needed).
   */
  static resetGlobalScope(): void {
    cachedGlobalScope = null;
  }
}

export default TestScopeUtils;
