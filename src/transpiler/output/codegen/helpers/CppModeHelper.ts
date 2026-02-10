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

import CodeGenState from "../CodeGenState";

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
  static maybeAddressOf(expr: string): string {
    return CodeGenState.cppMode ? expr : `&${expr}`;
  }

  /**
   * Get dereference expression for struct parameter access.
   * C mode: `(*expr)` (dereference pointer)
   * C++ mode: `expr` (reference can be used directly)
   *
   * @param expr - The expression to potentially dereference
   * @returns The expression with dereference in C mode
   */
  static maybeDereference(expr: string): string {
    return CodeGenState.cppMode ? expr : `(*${expr})`;
  }

  /**
   * Get the type modifier for struct parameter declarations.
   * C mode: `*` (pointer type)
   * C++ mode: `&` (reference type)
   *
   * @returns The type modifier character
   */
  static refOrPtr(): string {
    return CodeGenState.cppMode ? "&" : "*";
  }

  /**
   * Get the member access separator for struct parameters.
   * C mode: `->` (pointer member access)
   * C++ mode: `.` (reference member access)
   *
   * @returns The member access separator
   */
  static memberSeparator(): string {
    return CodeGenState.cppMode ? "." : "->";
  }

  /**
   * Get NULL literal for the current mode.
   * C mode: `NULL`
   * C++ mode: `nullptr`
   *
   * @returns The null pointer literal
   */
  static nullLiteral(): string {
    return CodeGenState.cppMode ? "nullptr" : "NULL";
  }

  /**
   * Generate a cast expression for the current mode.
   * C mode: `(type)expr`
   * C++ mode: `static_cast<type>(expr)`
   *
   * @param type - The target type
   * @param expr - The expression to cast
   * @returns The cast expression
   */
  static cast(type: string, expr: string): string {
    return CodeGenState.cppMode
      ? `static_cast<${type}>(${expr})`
      : `(${type})${expr}`;
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
  static reinterpretCast(type: string, expr: string): string {
    return CodeGenState.cppMode
      ? `reinterpret_cast<${type}>(${expr})`
      : `(${type})${expr}`;
  }

  /**
   * Check if we're in C++ mode.
   *
   * @returns True if generating C++ code
   */
  static isCppMode(): boolean {
    return CodeGenState.cppMode;
  }
}

export default CppModeHelper;
