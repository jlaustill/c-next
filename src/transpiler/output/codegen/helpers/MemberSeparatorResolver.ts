/**
 * Member Separator Resolver
 *
 * Determines the appropriate separator for member access chains in C-Next.
 * Different separators are used based on context:
 * - `_` for scope member access (Motor.speed -> Motor_speed)
 * - `_` for register field access (GPIO7.DR_SET -> GPIO7_DR_SET)
 * - `.` for struct member access (point.x -> point.x)
 * - `->` for struct parameter member access in C mode
 * - `::` for C++ namespace/class access
 *
 * Issue #387, #409, ADR-016
 */

import ISeparatorContext from "../types/ISeparatorContext";
import IMemberSeparatorDeps from "../types/IMemberSeparatorDeps";

/**
 * Static utility for resolving member access separators
 */
class MemberSeparatorResolver {
  /**
   * Build the separator context for a member access chain
   */
  static buildContext(
    firstId: string,
    hasGlobal: boolean,
    hasThis: boolean,
    currentScope: string | null,
    isStructParam: boolean,
    deps: IMemberSeparatorDeps,
    isCppAccess: boolean,
  ): ISeparatorContext {
    const isCrossScope =
      hasGlobal &&
      (deps.isKnownScope(firstId) || deps.isKnownRegister(firstId));

    const scopedRegName =
      hasThis && currentScope ? `${currentScope}_${firstId}` : null;

    const isScopedRegister =
      scopedRegName !== null && deps.isKnownRegister(scopedRegName);

    return {
      hasGlobal,
      isCrossScope,
      isStructParam,
      isCppAccess,
      scopedRegName,
      isScopedRegister,
    };
  }

  /**
   * Get the separator for the first member access operation
   */
  static getFirstSeparator(
    identifierChain: string[],
    memberName: string,
    ctx: ISeparatorContext,
    deps: IMemberSeparatorDeps,
  ): string {
    // C++ namespace/class access
    if (ctx.isCppAccess) {
      return "::";
    }

    // Struct parameter uses -> in C mode, . in C++ mode
    if (ctx.isStructParam) {
      return deps.getStructParamSeparator();
    }

    // Cross-scope access (global.Scope.member or global.Register.member)
    if (ctx.isCrossScope) {
      return "_";
    }

    // Register member access: GPIO7.DR_SET -> GPIO7_DR_SET
    if (deps.isKnownRegister(identifierChain[0])) {
      // Validate register access from inside scope requires global. prefix
      deps.validateRegisterAccess(
        identifierChain[0],
        memberName,
        ctx.hasGlobal,
      );
      return "_";
    }

    // Scope member access: Sensor.buffer -> Sensor_buffer
    // Works with or without global. prefix (both are valid syntax)
    if (deps.isKnownScope(identifierChain[0])) {
      // Issue #779: Skip cross-scope validation for scoped register access
      // Board.GPIO where Board_GPIO is a known register is valid
      const scopedRegisterName = `${identifierChain[0]}_${memberName}`;
      if (!deps.isKnownRegister(scopedRegisterName)) {
        deps.validateCrossScopeVisibility(identifierChain[0], memberName);
      }
      return "_";
    }

    // Scoped register: this.MOTOR_REG.SPEED -> Scope_MOTOR_REG_SPEED
    if (ctx.isScopedRegister) {
      return "_";
    }

    // Default: struct field access
    return ".";
  }

  /**
   * Get the separator for subsequent member access operations (after the first)
   */
  static getSubsequentSeparator(
    identifierChain: string[],
    ctx: ISeparatorContext,
    deps: IMemberSeparatorDeps,
  ): string {
    // Check for register chains
    const chainSoFar = identifierChain.slice(0, -1).join("_");
    const isRegisterChain =
      deps.isKnownRegister(identifierChain[0]) ||
      deps.isKnownRegister(chainSoFar) ||
      (ctx.scopedRegName !== null && deps.isKnownRegister(ctx.scopedRegName));

    return isRegisterChain ? "_" : ".";
  }

  /**
   * Get separator, dispatching to first or subsequent based on position
   */
  static getSeparator(
    isFirstOp: boolean,
    identifierChain: string[],
    memberName: string,
    ctx: ISeparatorContext,
    deps: IMemberSeparatorDeps,
  ): string {
    if (isFirstOp) {
      return MemberSeparatorResolver.getFirstSeparator(
        identifierChain,
        memberName,
        ctx,
        deps,
      );
    }
    return MemberSeparatorResolver.getSubsequentSeparator(
      identifierChain,
      ctx,
      deps,
    );
  }
}

export default MemberSeparatorResolver;
