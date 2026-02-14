/**
 * Test utilities for symbol collector tests.
 *
 * Provides mock IScopeSymbol instances for testing collectors
 * that now require proper scope references.
 *
 * Note: Delegates to ScopeUtils to avoid code duplication.
 */

import ScopeUtils from "../../../../../utils/ScopeUtils";
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
    return ScopeUtils.createGlobalScope();
  }

  /**
   * Create a named scope for tests.
   */
  static createMockScope(name: string, parent?: IScopeSymbol): IScopeSymbol {
    const actualParent = parent ?? ScopeUtils.createGlobalScope();
    return ScopeUtils.createScope(name, actualParent);
  }

  /**
   * Get a fresh global scope instance.
   * Returns a new instance each time to avoid test pollution.
   */
  static getGlobalScope(): IScopeSymbol {
    return ScopeUtils.createGlobalScope();
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
