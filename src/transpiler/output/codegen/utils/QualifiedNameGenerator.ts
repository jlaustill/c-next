/**
 * QualifiedNameGenerator - C-style name generation for C-Next symbols
 *
 * Provides transpiled C name generation for use in the output layer.
 * Delegates to ScopeUtils for the actual implementation to avoid duplication
 * with the types layer.
 *
 * Design decisions:
 * - Lives in output layer (codegen) since it generates C output
 * - Delegates to ScopeUtils for symbol-based name generation
 * - Provides string-based methods for backward compatibility
 * - Handles nested scopes: Outer.Inner.func -> Outer_Inner_func
 * - Global scope functions keep their bare names
 */
import type IFunctionSymbol from "../../../types/symbols/IFunctionSymbol";
import type IScopeSymbol from "../../../types/symbols/IScopeSymbol";
import SymbolRegistry from "../../../state/SymbolRegistry";
import ScopeUtils from "../../../../utils/ScopeUtils";
import QualifiedCName from "../../../../utils/QualifiedCName";

class QualifiedNameGenerator {
  // ============================================================================
  // Symbol-based methods (preferred)
  // ============================================================================

  /**
   * Generate the transpiled C name for a function.
   *
   * For global scope functions, returns the bare name (e.g., "main").
   * For scoped functions, returns "Scope_name" (e.g., "Test_fillData").
   * For nested scopes, returns "Outer_Inner_name" (e.g., "Outer_Inner_deepFunc").
   *
   * Delegates to ScopeUtils.getTranspiledCName() to avoid duplication.
   */
  static forFunction(func: IFunctionSymbol): string {
    return ScopeUtils.getTranspiledCName(func);
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
   * @returns Transpiled C name (e.g., "Test_fillData")
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

    // Fallback: build the name directly (dotted scope paths are expanded by join)
    return QualifiedCName.join(scopeName, funcName);
  }

  /**
   * Generate a qualified name for any scoped member (variable, enum, etc.).
   *
   * This is a simple string concatenation helper for non-function members.
   *
   * @param scopeName Scope name or undefined for global
   * @param memberName Member name
   * @returns Transpiled C name
   */
  static forMember(scopeName: string | undefined, memberName: string): string {
    return QualifiedCName.join(scopeName, memberName);
  }
}

export default QualifiedNameGenerator;
