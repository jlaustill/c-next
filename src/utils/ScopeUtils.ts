/**
 * Factory functions and type guards for IScopeSymbol.
 *
 * Provides utilities for creating and inspecting C-Next scopes.
 */
import type IScopeSymbol from "../transpiler/types/symbols/IScopeSymbol";
import ESourceLanguage from "./types/ESourceLanguage";

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
   * - scope: points to itself (self-reference)
   */
  static createGlobalScope(): IScopeSymbol {
    // Create a mutable object first to establish self-references
    const global: IScopeSymbol = {
      kind: "scope",
      name: "",
      parent: null as unknown as IScopeSymbol, // Temporary, will be set below
      scope: null as unknown as IScopeSymbol, // Temporary, will be set below
      members: [],
      functions: [],
      variables: [],
      memberVisibility: new Map(),
      sourceFile: "",
      sourceLine: 0,
      sourceLanguage: ESourceLanguage.CNext,
      isExported: true,
    };
    // Set self-references for global scope
    (global as unknown as { parent: IScopeSymbol }).parent = global;
    (global as unknown as { scope: IScopeSymbol }).scope = global;
    return global;
  }

  /**
   * Create a named scope with the given parent.
   *
   * Named scopes can be nested (e.g., Outer.Inner).
   */
  static createScope(name: string, parent: IScopeSymbol): IScopeSymbol {
    const scope: IScopeSymbol = {
      kind: "scope",
      name,
      parent,
      scope: parent, // Scope's containing scope is its parent
      members: [],
      functions: [],
      variables: [],
      memberVisibility: new Map(),
      sourceFile: "",
      sourceLine: 0,
      sourceLanguage: ESourceLanguage.CNext,
      isExported: true,
    };
    return scope;
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

  // ============================================================================
  // Path Utilities
  // ============================================================================

  /**
   * Get the scope path from outermost to innermost (excluding global scope).
   *
   * For scope "Outer.Inner", returns ["Outer", "Inner"].
   * For global scope, returns [].
   */
  static getScopePath(scope: IScopeSymbol): string[] {
    const path: string[] = [];
    let current = scope;

    while (!ScopeUtils.isGlobalScope(current)) {
      path.unshift(current.name);
      current = current.parent;
    }

    return path;
  }
}

export default ScopeUtils;
