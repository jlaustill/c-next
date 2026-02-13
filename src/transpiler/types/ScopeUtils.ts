/**
 * Factory functions and type guards for IScopeSymbol.
 *
 * Provides utilities for creating and inspecting C-Next scopes.
 */
import type IScopeSymbol from "./IScopeSymbol";
import type IFunctionSymbol from "./IFunctionSymbol";

class ScopeUtils {
  // ============================================================================
  // Factory Functions
  // ============================================================================

  /**
   * Create the global scope with self-reference parent.
   *
   * Global scope has:
   * - name: "" (empty string)
   * - parent: points to itself (self-reference)
   */
  static createGlobalScope(): IScopeSymbol {
    // Create a mutable object first to establish self-reference
    const global: {
      kind: "scope";
      name: string;
      parent: IScopeSymbol;
      functions: IFunctionSymbol[];
      variables: unknown[];
    } = {
      kind: "scope",
      name: "",
      parent: null as unknown as IScopeSymbol, // Temporary, will be set below
      functions: [],
      variables: [],
    };
    // Set self-reference
    global.parent = global;
    return global;
  }

  /**
   * Create a named scope with the given parent.
   *
   * Named scopes can be nested (e.g., Outer.Inner).
   */
  static createScope(name: string, parent: IScopeSymbol): IScopeSymbol {
    return {
      kind: "scope",
      name,
      parent,
      functions: [],
      variables: [],
    };
  }

  // ============================================================================
  // Type Guards
  // ============================================================================

  /**
   * Check if a scope is the global scope.
   *
   * Global scope is identified by:
   * - Empty name ("")
   * - Self-referential parent (parent === scope)
   */
  static isGlobalScope(scope: IScopeSymbol): boolean {
    return scope.name === "" && scope.parent === scope;
  }
}

export default ScopeUtils;
