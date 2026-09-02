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

  // #1298 removed `getScopePath`, a delegate to a `ScopeUtils` walk that no
  // longer exists: a scope's path is now a field on every symbol, so there is
  // nothing left to compute or to delegate.

  // ============================================================================
  // String-based methods (for transition - use symbol-based when possible)
  // ============================================================================

  /**
   * Generate a qualified function name for a function named inside a scope.
   *
   * Takes the scope PATH. #1285 replaced a leaf `string` with the scope symbol,
   * because the caller had to flatten a symbol to its leaf name and this had to
   * look it back up, losing any outer chain in between. #1298 makes it a string
   * again -- but the WHOLE path, which loses nothing, and which the caller already
   * holds.
   *
   * Falls back to qualifying the bare name when the function is not registered.
   */
  static forFunctionInScope(scopePath: string, funcName: string): string {
    const lookupScope =
      SymbolRegistry.getScope(scopePath) ?? SymbolRegistry.getGlobalScope();
    const func = SymbolRegistry.resolveFunction(funcName, lookupScope);
    if (func) {
      return this.forFunction(func);
    }
    return ScopeUtils.qualifyInScope(funcName, scopePath);
  }

  /**
   * The C name a bare member of `scope` is emitted under. **The canonical
   * spelling for `output/`.**
   *
   * A one-line delegate to `ScopeUtils.qualifyInScope`, so there is one
   * implementation and no divergence to fix. What it settles is which of the two
   * public NAMES a codegen call site uses, because the two take their arguments in
   * opposite orders -- `forMember(scopePath, name)` against `qualifyInScope(name,
   * scopePath)`. Two spellings of one decision sixty lines apart in a file is how a
   * silently inverted call gets written by the next person editing nearby (#1357
   * review).
   *
   * `logic/` cannot import from `output/` (depcruise `logic-cannot-import-output`),
   * so `ScopeUtils.qualifyInScope` remains that layer's door and this one is not a
   * replacement for it -- it is the door for the layer that CAN reach it.
   */
  static forMember(scopePath: string, memberName: string): string {
    return ScopeUtils.qualifyInScope(memberName, scopePath);
  }
}

export default QualifiedNameGenerator;
