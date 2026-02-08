/**
 * ScopeResolver - Handles scope visibility and access validation
 *
 * Extracted from CodeGenerator to reduce complexity.
 * Uses CodeGenState for all state access.
 *
 * ADR-016: Validates cross-scope member access visibility rules.
 * Issue #165: Enforces that:
 * - Cannot reference own scope by name (must use this. prefix)
 * - Cannot access private members from outside the scope
 * - Exception: global.Scope.member is allowed for explicit qualification
 */

import CodeGenState from "../CodeGenState";

/**
 * Resolves scope visibility and validates cross-scope access.
 * All methods are static - uses CodeGenState for state access.
 */
export default class ScopeResolver {
  /**
   * Validate cross-scope visibility for member access.
   * Throws an error if the access violates visibility rules.
   *
   * @param scopeName - The scope being accessed
   * @param memberName - The member being accessed
   * @param isGlobalAccess - Whether this is a global.Scope.member access
   */
  static validateCrossScopeVisibility(
    scopeName: string,
    memberName: string,
    isGlobalAccess: boolean = false,
  ): void {
    // Error if referencing own scope by name (must use this. prefix)
    // Exception: global.Scope.member is allowed for explicit qualification
    if (!isGlobalAccess && CodeGenState.currentScope === scopeName) {
      throw new Error(
        `Error: Cannot reference own scope '${scopeName}' by name. ` +
          `Use 'this.${memberName}' instead of '${scopeName}.${memberName}'`,
      );
    }

    // Check private member access (skip for own scope - we can access our own privates)
    const isOwnScope = CodeGenState.currentScope === scopeName;
    if (!isOwnScope) {
      const visibility = CodeGenState.symbols?.scopeMemberVisibility
        .get(scopeName)
        ?.get(memberName);
      if (visibility === "private") {
        const context = CodeGenState.currentScope
          ? `from scope '${CodeGenState.currentScope}'`
          : "from outside the scope";
        throw new Error(
          `Cannot access private member '${memberName}' of scope '${scopeName}' ${context}. ` +
            `Only public members are accessible outside their scope.`,
        );
      }
    }
  }
}
