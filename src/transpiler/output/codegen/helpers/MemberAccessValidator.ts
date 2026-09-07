/**
 * MemberAccessValidator - Shared validation for member access patterns
 *
 * Extracted from CodeGenerator.generateMemberAccess() and PostfixExpressionGenerator
 * to eliminate cross-file duplication of the write-only register member check
 * (ADR-013). The ADR-016 access checks that lived beside it are E0435-E0437 in
 * pass 2.1 (#1322).
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
}

export default MemberAccessValidator;
