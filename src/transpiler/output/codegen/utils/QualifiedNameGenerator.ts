/**
 * QualifiedNameGenerator - C-style name generation for C-Next symbols
 *
 * Provides C-style mangled name generation for use in the output layer.
 * Delegates to FunctionUtils.getCMangledName() for the actual implementation
 * to avoid duplication with the types layer.
 *
 * Design decisions:
 * - Lives in output layer (codegen) since it generates C output
 * - Delegates to FunctionUtils for symbol-based name generation
 * - Provides string-based methods for backward compatibility
 * - Handles nested scopes: Outer.Inner.func -> Outer_Inner_func
 * - Global scope functions keep their bare names
 */
import type IFunctionSymbol from "../../../types/IFunctionSymbol";
import type IScopeSymbol from "../../../types/IScopeSymbol";
import SymbolRegistry from "../../../state/SymbolRegistry";
import FunctionUtils from "../../../types/FunctionUtils";
import ScopeUtils from "../../../types/ScopeUtils";

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
   *
   * Delegates to FunctionUtils.getCMangledName() to avoid duplication.
   */
  static forFunction(func: IFunctionSymbol): string {
    return FunctionUtils.getCMangledName(func);
  }

  /**
   * Get the scope path as an array of scope names (outermost first).
   *
   * Returns empty array for global scope.
   * Returns ["Test"] for scope "Test".
   * Returns ["Outer", "Inner"] for scope "Outer.Inner".
   *
   * Delegates to ScopeUtils.getScopePath() to avoid duplication.
   */
  static getScopePath(scope: IScopeSymbol): string[] {
    return ScopeUtils.getScopePath(scope);
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
    // Try SymbolRegistry first (using getScope to avoid creating orphaned scopes)
    if (scopeName) {
      const scope = SymbolRegistry.getScope(scopeName);
      if (scope) {
        const func = SymbolRegistry.resolveFunction(funcName, scope);
        if (func) {
          return this.forFunction(func);
        }
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
