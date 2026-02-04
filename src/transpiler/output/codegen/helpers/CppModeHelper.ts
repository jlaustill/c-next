/**
 * CppModeHelper - Utilities for C/C++ mode-specific code generation
 *
 * Issue #644: Extracted from CodeGenerator to consolidate cppMode conditionals.
 *
 * In C mode, struct parameters are passed by pointer (need & for address, * for type).
 * In C++ mode, struct parameters are passed by reference (no & needed, & for type).
 */

/**
 * Options for C/C++ mode helpers.
 */
interface CppModeOptions {
  /** Whether we're generating C++ code */
  cppMode: boolean;
}

/**
 * Helper class for C/C++ mode-specific code generation patterns.
 */
class CppModeHelper {
  private readonly cppMode: boolean;

  constructor(options: CppModeOptions) {
    this.cppMode = options.cppMode;
  }

  /**
   * Get address-of expression for struct parameter passing.
   * C mode: `&expr` (pass pointer to struct)
   * C++ mode: `expr` (pass reference directly)
   *
   * @param expr - The expression to potentially wrap
   * @returns The expression with address-of operator in C mode
   */
  maybeAddressOf(expr: string): string {
    return this.cppMode ? expr : `&${expr}`;
  }

  /**
   * Get dereference expression for struct parameter access.
   * C mode: `(*expr)` (dereference pointer)
   * C++ mode: `expr` (reference can be used directly)
   *
   * @param expr - The expression to potentially dereference
   * @returns The expression with dereference in C mode
   */
  maybeDereference(expr: string): string {
    return this.cppMode ? expr : `(*${expr})`;
  }

  /**
   * Get the type modifier for struct parameter declarations.
   * C mode: `*` (pointer type)
   * C++ mode: `&` (reference type)
   *
   * @returns The type modifier character
   */
  refOrPtr(): string {
    return this.cppMode ? "&" : "*";
  }

  /**
   * Get the member access separator for struct parameters.
   * C mode: `->` (pointer member access)
   * C++ mode: `.` (reference member access)
   *
   * @returns The member access separator
   */
  memberSeparator(): string {
    return this.cppMode ? "." : "->";
  }

  /**
   * Get NULL literal for the current mode.
   * C mode: `NULL`
   * C++ mode: `nullptr`
   *
   * @returns The null pointer literal
   */
  nullLiteral(): string {
    return this.cppMode ? "nullptr" : "NULL";
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
  cast(type: string, expr: string): string {
    return this.cppMode ? `static_cast<${type}>(${expr})` : `(${type})${expr}`;
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
  reinterpretCast(type: string, expr: string): string {
    return this.cppMode
      ? `reinterpret_cast<${type}>(${expr})`
      : `(${type})${expr}`;
  }

  /**
   * Check if we're in C++ mode.
   *
   * @returns True if generating C++ code
   */
  isCppMode(): boolean {
    return this.cppMode;
  }
}

export default CppModeHelper;
