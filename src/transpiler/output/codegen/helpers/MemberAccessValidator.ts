/**
 * MemberAccessValidator - Shared validation for member access patterns
 *
 * Extracted from CodeGenerator.generateMemberAccess() and PostfixExpressionGenerator
 * to eliminate cross-file duplication of:
 * - Write-only register member checks (ADR-013)
 * - Self-referential scope access checks (ADR-016/057)
 */

class MemberAccessValidator {
  /**
   * ADR-013: Validate that a register member is not write-only when reading.
   * @param registerKey - underscore-joined key (e.g., "GPIO7_DR")
   * @param memberName - member being accessed (e.g., "DR")
   * @param displayName - dot-notation for error (e.g., "GPIO7.DR")
   * @param registerMemberAccess - map of register member access modifiers
   * @param isAssignmentTarget - true to skip check (write context)
   */
  static validateRegisterReadAccess(
    registerKey: string,
    memberName: string,
    displayName: string,
    registerMemberAccess: ReadonlyMap<string, string>,
    isAssignmentTarget: boolean,
  ): void {
    if (isAssignmentTarget) {
      return;
    }
    const accessMod = registerMemberAccess.get(registerKey);
    if (accessMod === "wo") {
      throw new Error(
        `cannot read from write-only register member '${memberName}' ` +
          `(${displayName} has 'wo' access modifier)`,
      );
    }
  }

  /**
   * ADR-016/057: Validate not referencing own scope by name.
   * @param scopeName - scope being accessed
   * @param memberName - member after scope (for error message)
   * @param currentScope - active scope context (null = not in a scope)
   */
  static validateNotSelfScopeReference(
    scopeName: string,
    memberName: string,
    currentScope: string | null,
  ): void {
    if (currentScope && scopeName === currentScope) {
      throw new Error(
        `Error: Cannot reference own scope '${scopeName}' by name. Use 'this.${memberName}' instead of '${scopeName}.${memberName}'`,
      );
    }
  }

  /**
   * ADR-016/057: Validate that a global entity (enum or register) is accessed
   * with 'global.' prefix when inside a scope that has a naming conflict.
   *
   * @param entityName - The entity being accessed (e.g., "Color", "GPIO")
   * @param memberName - The member after the entity (e.g., "Red", "PIN0")
   * @param entityType - "enum" or "register" (for error message)
   * @param currentScope - Active scope context (null = not in a scope)
   * @param isGlobalAccess - Whether the access used 'global.' prefix
   * @param scopeMembers - Map of scope names to their member names (for conflict detection)
   */
  static validateGlobalEntityAccess(
    entityName: string,
    memberName: string,
    entityType: string,
    currentScope: string | null,
    isGlobalAccess: boolean,
    scopeMembers?: ReadonlyMap<string, ReadonlySet<string>>,
  ): void {
    if (isGlobalAccess) {
      return;
    }
    if (currentScope) {
      const belongsToCurrentScope = entityName.startsWith(currentScope + "_");
      if (belongsToCurrentScope) {
        return;
      }
      // Only require global. prefix when there's a naming conflict
      // (scope has a member with the same name as the entity)
      const scopeMemberNames = scopeMembers?.get(currentScope);
      const hasConflict = scopeMemberNames?.has(entityName) ?? false;
      if (hasConflict) {
        throw new Error(
          `Error: Use 'global.${entityName}.${memberName}' to access ${entityType} '${entityName}' from inside scope '${currentScope}'`,
        );
      }
    }
  }
}

export default MemberAccessValidator;
