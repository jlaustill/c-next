/**
 * Test utilities for symbol collector tests.
 *
 * Provides mock IScopeSymbol instances for tests that need a scope OBJECT --
 * the registry's member lists. Collectors themselves take a `scopePath` string
 * (#1298) and need nothing from here.
 *
 * Note: Delegates to ScopeUtils to avoid code duplication.
 */

import ScopeUtils from "../../../../utils/ScopeUtils";
import IScopeSymbol from "../../../../transpiler/types/symbols/IScopeSymbol";

/**
 * Static utility class for creating mock scopes in tests.
 *
 * Note: Each call creates a fresh scope instance to avoid test pollution.
 * Tests construct their own `SymbolRegistry`; isolation is what you get by
 * default rather than what you must remember (#1452 box 3).
 */
class TestScopeUtils {
  /**
   * Create a named scope for tests.
   */
  static createMockScope(name: string, parentPath = ""): IScopeSymbol {
    return ScopeUtils.createScope(name, parentPath);
  }

  /**
   * Reset global scope (no-op, kept for backwards compatibility).
   * @deprecated Construct a fresh `SymbolRegistry` instead (#1452 box 3).
   */
  static resetGlobalScope(): void {
    // No-op - each call to getGlobalScope() now returns a fresh instance
  }
}

export default TestScopeUtils;
