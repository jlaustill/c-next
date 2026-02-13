/**
 * Test utilities for symbol collector tests.
 *
 * Provides mock IScopeSymbol instances for testing collectors
 * that now require proper scope references.
 */

import ESourceLanguage from "../../../../../utils/types/ESourceLanguage";
import IScopeSymbol from "../../../../types/symbols/IScopeSymbol";

/**
 * Static utility class for creating mock scopes in tests.
 *
 * Note: Each call creates a fresh scope instance to avoid test pollution.
 * Tests should use SymbolRegistry.reset() in beforeEach for state isolation.
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
   * Get a fresh global scope instance.
   * Returns a new instance each time to avoid test pollution.
   */
  static getGlobalScope(): IScopeSymbol {
    return TestScopeUtils.createMockGlobalScope();
  }

  /**
   * Reset global scope (no-op, kept for backwards compatibility).
   * @deprecated Use SymbolRegistry.reset() instead for test isolation.
   */
  static resetGlobalScope(): void {
    // No-op - each call to getGlobalScope() now returns a fresh instance
  }
}

export default TestScopeUtils;
