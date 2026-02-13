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

class QualifiedNameGenerator {
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
}

export default QualifiedNameGenerator;
