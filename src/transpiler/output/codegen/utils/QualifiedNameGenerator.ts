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
   * Generate a qualified function name for a function named inside a scope.
   *
   * Takes the scope SYMBOL. #1285: the previous signature took a `string` and
   * immediately did `SymbolRegistry.getScope(scopeName)` to recover the symbol --
   * so the caller had to flatten a symbol to its leaf name and this had to look it
   * back up, losing any outer chain in between. Callers hold the symbol already.
   *
   * Falls back to qualifying the bare name when the function is not registered.
   */
  static forFunctionInScope(
    scope: IScopeSymbol | null,
    funcName: string,
  ): string {
    const lookupScope = scope ?? SymbolRegistry.getGlobalScope();
    const func = SymbolRegistry.resolveFunction(funcName, lookupScope);
    if (func) {
      return this.forFunction(func);
    }
    return ScopeUtils.qualifyInScope(funcName, scope);
  }

  /**
   * The C name a bare member of `scope` is emitted under. **The canonical
   * spelling for `output/`.**
   *
   * A one-line delegate to `ScopeUtils.qualifyInScope`, so there is one
   * implementation and no divergence to fix. What it settles is which of the two
   * public NAMES a codegen call site uses, because the two take their arguments in
   * opposite orders -- `forMember(scope, name)` against `qualifyInScope(name,
   * scope)`. Two spellings of one decision sixty lines apart in a file is how a
   * silently inverted call gets written by the next person editing nearby (#1357
   * review).
   *
   * `logic/` cannot import from `output/` (depcruise `logic-cannot-import-output`),
   * so `ScopeUtils.qualifyInScope` remains that layer's door and this one is not a
   * replacement for it -- it is the door for the layer that CAN reach it.
   */
  static forMember(scope: IScopeSymbol | null, memberName: string): string {
    return ScopeUtils.qualifyInScope(memberName, scope);
  }
}

export default QualifiedNameGenerator;
