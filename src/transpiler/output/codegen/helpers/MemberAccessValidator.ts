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
   * Detects two types of conflicts:
   * 1. Scope member with same name as entity (via scopeMembers lookup)
   * 2. Identifier was resolved to scope member, shadowing a global enum
   *    (via rootIdentifier != resolvedName comparison)
   *
   * @param entityName - The resolved entity name (e.g., "Color" or "Motor_Color")
   * @param memberName - The member after the entity (e.g., "Red", "PIN0")
   * @param entityType - "enum" or "register" (for error message)
   * @param currentScope - Active scope context (null = not in a scope)
   * @param isGlobalAccess - Whether the access used 'global.' prefix
   * @param options - Optional conflict detection parameters
   * @param options.scopeMembers - Map of scope names to their member names
   * @param options.rootIdentifier - Original identifier before resolution (for shadowing detection)
   * @param options.knownEnums - Set of known enum names (for shadowing detection)
   */
  static validateGlobalEntityAccess(
    entityName: string,
    memberName: string,
    entityType: string,
    currentScope: string | null,
    isGlobalAccess: boolean,
    options?: {
      scopeMembers?: ReadonlyMap<string, ReadonlySet<string>>;
      rootIdentifier?: string;
      knownEnums?: ReadonlySet<string>;
    },
  ): void {
    if (isGlobalAccess) {
      return;
    }
    if (!currentScope) {
      return;
    }

    const { scopeMembers, rootIdentifier, knownEnums } = options ?? {};

    // Check 1: Shadowing detection - identifier was resolved to a scope member
    // that shadows a global enum. This produces invalid C (e.g., Motor_Color.RED).
    // This check must run BEFORE the belongsToCurrentScope check because
    // the resolved name (e.g., Motor_Color) will start with the scope prefix.
    if (rootIdentifier && knownEnums) {
      const wasResolved = entityName !== rootIdentifier;
      const rootIsEnum = knownEnums.has(rootIdentifier);
      const resolvedIsNotEnum = !knownEnums.has(entityName);
      if (wasResolved && rootIsEnum && resolvedIsNotEnum) {
        throw new Error(
          `Error: Use 'global.${rootIdentifier}.${memberName}' to access enum '${rootIdentifier}' from inside scope '${currentScope}' (scope member '${rootIdentifier}' shadows the global enum)`,
        );
      }
    }

    // Skip check if entity belongs to current scope (e.g., Motor_State in scope Motor)
    const belongsToCurrentScope = entityName.startsWith(currentScope + "_");
    if (belongsToCurrentScope) {
      return;
    }

    // Check 2: Direct conflict - scope has a member with the same name as the entity
    const scopeMemberNames = scopeMembers?.get(currentScope);
    const hasConflict = scopeMemberNames?.has(entityName) ?? false;
    if (hasConflict) {
      throw new Error(
        `Error: Use 'global.${entityName}.${memberName}' to access ${entityType} '${entityName}' from inside scope '${currentScope}'`,
      );
    }
  }
}

export default MemberAccessValidator;
