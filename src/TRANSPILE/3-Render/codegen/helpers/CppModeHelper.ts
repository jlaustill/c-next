import type TranspileState from "../../../TranspileState";
/**
 * CppModeHelper - Utilities for C/C++ mode-specific code generation
 *
 * Issue #644: Extracted from CodeGenerator to consolidate cppMode conditionals.
 *
 * In C mode, struct parameters are passed by pointer (need & for address, * for type).
 * In C++ mode, struct parameters are passed by reference (no & needed, & for type).
 *
 * Migrated to use CodeGenState instead of constructor DI.
 */

/**
 * Static helper class for C/C++ mode-specific code generation patterns.
 */
class CppModeHelper {
  /**
   * Get address-of expression for struct parameter passing.
   * C mode: `&expr` (pass pointer to struct)
   * C++ mode: `expr` (pass reference directly)
   *
   * @param expr - The expression to potentially wrap
   * @returns The expression with address-of operator in C mode
   */
  static maybeAddressOf(expr: string, state: TranspileState): string {
    return state.cppMode ? expr : `&${expr}`;
  }

  /**
   * Get dereference expression for struct parameter access.
   * C mode: `(*expr)` (dereference pointer)
   * C++ mode: `expr` (reference can be used directly)
   *
   * @param expr - The expression to potentially dereference
   * @returns The expression with dereference in C mode
   */
  static maybeDereference(expr: string, state: TranspileState): string {
    return state.cppMode ? expr : `(*${expr})`;
  }

  /**
   * Get the type modifier for struct parameter declarations.
   * C mode: `*` (pointer type)
   * C++ mode: `&` (reference type)
   *
   * @returns The type modifier character
   */
  static refOrPtr(state: TranspileState): string {
    return state.cppMode ? "&" : "*";
  }

  /**
   * Get NULL literal for the current mode.
   * C mode: `NULL`
   * C++ mode: `nullptr`
   *
   * @returns The null pointer literal
   */
  static nullLiteral(state: TranspileState): string {
    return state.cppMode ? "nullptr" : "NULL";
  }

  /**
   * Generate a cast expression for the current mode.
   * C mode: `(type)expr`, or `(type)(expr)` when expr has an operator
   * C++ mode: `static_cast<type>(expr)`
   *
   * @param type - The target type
   * @param expr - The expression to cast
   * @returns The cast expression
   */
  static cast(type: string, expr: string, state: TranspileState): string {
    return CppModeHelper.castIn(state.cppMode, type, expr);
  }

  /**
   * The same decision for a caller that holds the mode rather than the
   * state -- a helper emitted once per file (#1668)
   *
   * The two modes cast the whole expression. A C cast binds tighter than any
   * binary operator, so `(float)x << 1` shifted a float, which C rejects,
   * where C++ shifted and then converted (#1760 review).
   */
  static castIn(cppMode: boolean, type: string, expr: string): string {
    return cppMode
      ? `static_cast<${type}>(${expr})`
      : CppModeHelper.cStyleCast(type, expr);
  }

  /** A C cast of the whole of `expr`: parenthesized when it has an operator */
  private static cStyleCast(type: string, expr: string): string {
    return CppModeHelper.hasOperator(expr)
      ? `(${type})(${expr})`
      : `(${type})${expr}`;
  }

  /**
   * Whether generated C has an operator outside brackets and literals. The
   * generator spaces every binary and ternary operator, and nothing else at
   * that depth, so such a space is one.
   */
  private static hasOperator(expr: string): boolean {
    let depth = 0;
    let quote: string | null = null;
    for (let i = 0; i < expr.length; i++) {
      const ch = expr[i];
      if (quote !== null) {
        if (ch === "\\") i++;
        else if (ch === quote) quote = null;
      } else if (ch === '"' || ch === "'") {
        quote = ch;
      } else if ("([{".includes(ch)) {
        depth++;
      } else if (")]}".includes(ch)) {
        depth--;
      } else if (depth === 0 && /\s/.test(ch)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Generate a reinterpret cast expression for the current mode.
   * C mode: `(type)expr`
   * C++ mode: `reinterpret_cast<type>(expr)`
   *
   * @param type - The target type
   * @param expr - The expression to cast
   * @returns The cast expression
   */
  static reinterpretCast(
    type: string,
    expr: string,
    state: TranspileState,
  ): string {
    return state.cppMode
      ? `reinterpret_cast<${type}>(${expr})`
      : CppModeHelper.cStyleCast(type, expr);
  }
}

export default CppModeHelper;
