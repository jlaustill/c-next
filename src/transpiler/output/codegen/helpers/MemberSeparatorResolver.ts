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
import QualifiedCName from "../../../../utils/QualifiedCName";
import ScopeUtils from "../../../../utils/ScopeUtils";

/**
 * Input parameters for building a separator context
 */
interface IBuildContextInput {
  firstId: string;
  hasGlobal: boolean;
  hasThis: boolean;
  currentScopePath: string;
  isStructParam: boolean;
  isCppAccess: boolean;
  forcePointerSemantics?: boolean;
}

/**
 * Static utility for resolving member access separators
 */
class MemberSeparatorResolver {
  /**
   * Build the separator context for a member access chain
   */
  static buildContext(
    input: IBuildContextInput,
    deps: IMemberSeparatorDeps,
  ): ISeparatorContext {
    const {
      firstId,
      hasGlobal,
      hasThis,
      currentScopePath,
      isStructParam,
      isCppAccess,
      forcePointerSemantics,
    } = input;
    const isCrossScope =
      hasGlobal &&
      (deps.isKnownScope(firstId) || deps.isKnownRegister(firstId));

    const scopedRegName =
      hasThis && currentScopePath
        ? ScopeUtils.qualifyInScope(firstId, currentScopePath)
        : null;

    const isScopedRegister =
      scopedRegName !== null && deps.isKnownRegister(scopedRegName);

    return {
      isCrossScope,
      isStructParam,
      isCppAccess,
      scopedRegName,
      isScopedRegister,
      forcePointerSemantics,
    };
  }

  /**
   * Get the separator for the first member access operation
   */
  static getFirstSeparator(
    identifierChain: string[],
    ctx: ISeparatorContext,
    deps: IMemberSeparatorDeps,
  ): string {
    // C++ namespace/class access
    if (ctx.isCppAccess) {
      return "::";
    }

    // Struct parameter uses -> in C mode, . in C++ mode
    // Issue #895: forcePointerSemantics overrides C++ mode to use ->
    if (ctx.isStructParam) {
      if (ctx.forcePointerSemantics) {
        return "->";
      }
      return deps.getStructParamSeparator();
    }

    // Cross-scope access (global.Scope.member or global.Register.member)
    if (ctx.isCrossScope) {
      return QualifiedCName.SEPARATOR;
    }

    // Register member access: GPIO7.DR_SET -> GPIO7_DR_SET
    if (deps.isKnownRegister(identifierChain[0])) {
      // #1322: the shadowed-register check that stood here is E0437 in pass
      // 2.1 (ADR-016); codegen only spells the C name.
      return QualifiedCName.SEPARATOR;
    }

    // Scope member access: Sensor.buffer -> Sensor_buffer
    // Works with or without global. prefix (both are valid syntax)
    if (deps.isKnownScope(identifierChain[0])) {
      // #1322: the cross-scope visibility check that stood here -- with its
      // #779 exemption for a scoped register -- is E0435/E0436 in pass 2.1,
      // where the same exemption is stated once for all three positions.
      return QualifiedCName.SEPARATOR;
    }

    // Scoped register: this.MOTOR_REG.SPEED -> Scope_MOTOR_REG_SPEED
    if (ctx.isScopedRegister) {
      return QualifiedCName.SEPARATOR;
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
    const chainSoFar = QualifiedCName.fromParts(identifierChain.slice(0, -1));
    const isRegisterChain =
      deps.isKnownRegister(identifierChain[0]) ||
      deps.isKnownRegister(chainSoFar) ||
      (ctx.scopedRegName !== null && deps.isKnownRegister(ctx.scopedRegName));

    return isRegisterChain ? QualifiedCName.SEPARATOR : ".";
  }

  /**
   * Get separator, dispatching to first or subsequent based on position
   */
  static getSeparator(
    isFirstOp: boolean,
    identifierChain: string[],
    ctx: ISeparatorContext,
    deps: IMemberSeparatorDeps,
  ): string {
    if (isFirstOp) {
      return MemberSeparatorResolver.getFirstSeparator(
        identifierChain,
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
