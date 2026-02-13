/**
 * QualifiedNameGenerator - C-style name generation for C-Next symbols
 *
 * This is the ONLY place that constructs C-style mangled names like "Test_fillData".
 *
 * Design decisions:
 * - Lives in output layer (codegen) since it generates C output
 * - Takes symbol objects and generates C-style names
 * - Handles nested scopes: Outer.Inner.func -> Outer_Inner_func
 * - Global scope functions keep their bare names
 */
import type IFunctionSymbol from "../../../types/IFunctionSymbol";
import type IScopeSymbol from "../../../types/IScopeSymbol";
import SymbolRegistry from "../../../state/SymbolRegistry";

class QualifiedNameGenerator {
  // ============================================================================
  // Symbol-based methods (preferred)
  // ============================================================================

  /**
   * Generate the C-style mangled name for a function.
   *
   * For global scope functions, returns the bare name (e.g., "main").
   * For scoped functions, returns "Scope_name" (e.g., "Test_fillData").
   * For nested scopes, returns "Outer_Inner_name" (e.g., "Outer_Inner_deepFunc").
   */
  static forFunction(func: IFunctionSymbol): string {
    const scopePath = this.getScopePath(func.scope);
    if (scopePath.length === 0) {
      return func.name;
    }
    return [...scopePath, func.name].join("_");
  }

  /**
   * Get the scope path as an array of scope names (outermost first).
   *
   * Returns empty array for global scope.
   * Returns ["Test"] for scope "Test".
   * Returns ["Outer", "Inner"] for scope "Outer.Inner".
   */
  static getScopePath(scope: IScopeSymbol): string[] {
    // Global scope: name is "" and parent is self
    if (scope.name === "" || scope.parent === scope) {
      return [];
    }
    return [...this.getScopePath(scope.parent), scope.name];
  }

  // ============================================================================
  // String-based methods (for transition - use symbol-based when possible)
  // ============================================================================

  /**
   * Generate a qualified function name from strings.
   *
   * Tries to look up the function in SymbolRegistry first.
   * Falls back to simple string concatenation if not found.
   *
   * @param scopeName Scope name (e.g., "Test", "Outer.Inner") or undefined for global
   * @param funcName Bare function name (e.g., "fillData")
   * @returns C-mangled name (e.g., "Test_fillData")
   */
  static forFunctionStrings(
    scopeName: string | undefined,
    funcName: string,
  ): string {
    // Try SymbolRegistry first
    if (scopeName) {
      const scope = SymbolRegistry.getOrCreateScope(scopeName);
      const func = SymbolRegistry.resolveFunction(funcName, scope);
      if (func) {
        return this.forFunction(func);
      }
    } else {
      const global = SymbolRegistry.getGlobalScope();
      const func = SymbolRegistry.resolveFunction(funcName, global);
      if (func) {
        return this.forFunction(func);
      }
    }

    // Fallback to string concatenation
    if (!scopeName) {
      return funcName;
    }
    // Convert dotted scope path to underscores
    const scopePrefix = scopeName.replace(/\./g, "_");
    return `${scopePrefix}_${funcName}`;
  }

  /**
   * Generate a qualified name for any scoped member (variable, enum, etc.).
   *
   * This is a simple string concatenation helper for non-function members.
   *
   * @param scopeName Scope name or undefined for global
   * @param memberName Member name
   * @returns C-mangled name
   */
  static forMember(scopeName: string | undefined, memberName: string): string {
    if (!scopeName) {
      return memberName;
    }
    const scopePrefix = scopeName.replace(/\./g, "_");
    return `${scopePrefix}_${memberName}`;
  }
}

export default QualifiedNameGenerator;
