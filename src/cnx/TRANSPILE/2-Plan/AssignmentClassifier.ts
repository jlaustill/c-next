/**
 * Assignment classifier for dispatch-based code generation (ADR-065).
 *
 * Analyzes an assignment context and determines which AssignmentKind it is.
 * The classification order matches the original generateAssignment() method's
 * if-else chain to ensure identical behavior.
 *
 * Migrated to use CodeGenState instead of constructor DI.
 */
import AssignmentKind from "../../types/AssignmentKind";
import IAssignmentContext from "./types/IAssignmentContext";
import invariant from "../../utils/invariant";
import SubscriptDepthValidator from "./SubscriptDepthValidator";
import TTypeInfo from "../../types/TTypeInfo";
import type TOverflowBehavior from "../../types/TOverflowBehavior";
import type IChainBase from "../../types/IChainBase";
import OperandTyper from "../../utils/OperandTyper";
import TypeCheckUtils from "../../utils/TypeCheckUtils";
import CompoundOperator from "../../utils/CompoundOperator";
import CLAMP_HELPER_FOR_OPERATOR from "../../types/CLAMP_HELPER_FOR_OPERATOR";

/**
 * Classifies assignment statements by analyzing their structure.
 *
 * Classification priority (higher = checked first):
 * 1. Bitmap field assignments (memberAccess patterns)
 * 2. Register bit/bitmap assignments
 * 3. Global/this prefix patterns
 * 4. Array/bit access patterns
 * 5. Atomic/overflow special cases
 * 6. String assignments
 * 7. Simple fallback
 */
class AssignmentClassifier {
  /**
   * Check if typeInfo represents a simple string type (not a 2D+ string array).
   */
  /**
   * The type info of the assignment TARGET, for the three simple patterns.
   *
   * #1450: one decision, and it was derived twice. `classifySpecialCompound`
   * resolved it across three branches to classify atomics and overflow clamps;
   * the three string classifiers resolved it again, branch for branch, sixty
   * lines below. They agreed, which is the failure mode rather than the
   * defense -- changing how a target resolves (qualifying `global.member`, say)
   * meant editing both, and nothing said so.
   *
   * The pattern GUARD stays with each caller, because the pattern is what picks
   * the `AssignmentKind`. Only the resolution is shared: what a target is named
   * is one question, and which kind that makes the assignment is another.
   *
   * `undefined` for a target that is none of the three, which is exactly what
   * its callers already treated a missing type info as.
   *
   * #1668 (C7): the resolution is the target's binding now, made once where
   * the target is typed. This used to re-spell the target as a registry key --
   * the bare name, or `qualifyInScope` for `this.` -- and a bare spelling of a
   * scope member only agreed with the qualified one because an unrelated
   * cross-file fallback caught the registry's miss. The binder reads `this.`
   * and `global.` off the target itself, so there is no key to get right.
   */
  static targetTypeInfo(ctx: IAssignmentContext): TTypeInfo | undefined {
    const isSimple =
      ctx.isSimpleIdentifier ||
      ctx.isSimpleThisAccess ||
      ctx.isSimpleGlobalAccess;
    return isSimple ? ctx.target.typeInfo : undefined;
  }

  private static isSimpleStringType(typeInfo: TTypeInfo | undefined): boolean {
    return (
      typeInfo?.isString === true &&
      typeInfo.stringCapacity !== undefined &&
      (!typeInfo.arrayDimensions || typeInfo.arrayDimensions.length <= 1)
    );
  }

  /**
   * Classify an assignment context into an AssignmentKind.
   */
  static classify(ctx: IAssignmentContext): AssignmentKind {
    // #1782: a whole array given its list, whatever the target's shape
    if (ctx.plannedWholeArray !== null) {
      return AssignmentKind.WHOLE_ARRAY;
    }

    // === Priority 0: Atomic/overflow compound assignments ===
    // #1411/#1887: asked before any shape, because a field or an element
    // saturates like a variable does; the shape kinds below write `+=`.
    const specialKind = AssignmentClassifier.classifySpecialCompound(ctx);
    if (specialKind !== null) {
      return specialKind;
    }

    // === Priority 1: Bitmap field assignments ===
    const bitmapKind = AssignmentClassifier.classifyBitmapField(ctx);
    if (bitmapKind !== null) {
      return bitmapKind;
    }

    // === Priority 1b: A register member's bit or bit range ===
    const registerBitKind = AssignmentClassifier.classifyRegisterBit(ctx);
    if (registerBitKind !== null) {
      return registerBitKind;
    }

    // === Priority 2: Member access with subscripts (arrays) ===
    const memberSubscriptKind =
      AssignmentClassifier.classifyMemberWithSubscript(ctx);
    if (memberSubscriptKind !== null) {
      return memberSubscriptKind;
    }

    // === Priority 3: Global/this prefix patterns ===
    const prefixKind = AssignmentClassifier.classifyPrefixPattern(ctx);
    if (prefixKind !== null) {
      return prefixKind;
    }

    // === Priority 4: Simple array/bit access ===
    const arrayBitKind = AssignmentClassifier.classifyArrayOrBitAccess(ctx);
    if (arrayBitKind !== null) {
      return arrayBitKind;
    }

    // === Priority 6: String assignments ===
    const stringKind = AssignmentClassifier.classifyStringAssignment(ctx);
    if (stringKind !== null) {
      return stringKind;
    }

    // === Priority 7: Member chain fallback ===
    // Any member access with subscripts that didn't match a more specific pattern
    if (ctx.hasMemberAccess && ctx.hasArrayAccess) {
      return AssignmentKind.MEMBER_CHAIN;
    }

    // === Fallback: Simple assignment ===
    return AssignmentKind.SIMPLE;
  }

  /**
   * #1749: a field of a bitmap -- `flags.A`, `gss[1].fl.Mode`, `Sc.ps.fls[1].A`,
   * `this.fl.A`, `MOTOR.CTRL.Mode` -- is the typer's answer for the chain's last
   * step, whatever spells its prefix. A register member only changes which
   * handler writes it: ADR-004 writes a member per its access, not by a
   * read-modify-write (#2158), and the typer names the member.
   */
  private static classifyBitmapField(
    ctx: IAssignmentContext,
  ): AssignmentKind | null {
    if (ctx.bitmapField === null) {
      return null;
    }
    return ctx.target.last!.beforeRegisterMember === null
      ? AssignmentKind.BITMAP_FIELD
      : AssignmentKind.REGISTER_MEMBER_BITMAP_FIELD;
  }

  /**
   * Classify member access with subscripts.
   * Patterns: arr[i][j], struct.arr[i], matrix[i][j][bit]
   */
  private static classifyMemberWithSubscript(
    ctx: IAssignmentContext,
  ): AssignmentKind | null {
    // Need subscripts through memberAccess pattern
    if (!ctx.hasMemberAccess || ctx.subscriptCount === 0) {
      return null;
    }

    // Skip this.* and global.* patterns - they're handled by classifyPrefixPattern
    if (ctx.hasThis || ctx.hasGlobal) {
      return null;
    }

    const ids = ctx.identifiers;
    const typeInfo = ctx.target.rootTypeInfo;

    // A register's bits were classified before this, by `classifyRegisterBit`:
    // a bit range is two expressions in ONE op, so the struct-chain branch
    // below would claim `REG.MEMBER[start, width]` (#1244, #1052).

    // Bare `Scope.member[...]`: the fourth ADR-016 spelling (#1116). A bare
    // name resolves through ADR-057's tiers, so `resolvesBareName` is true.
    const scopeQualifiedKind =
      AssignmentClassifier.classifyScopeQualifiedSubscript(ctx, "", true);
    if (scopeQualifiedKind !== null) {
      return scopeQualifiedKind;
    }

    // Check for bit range through struct chain: devices[0].control[0, 4]
    // Detected by last subscript having 2 expressions (start, width)
    if (ctx.lastSubscriptExprCount === 2) {
      return AssignmentKind.STRUCT_CHAIN_BIT_RANGE;
    }

    // Multi-dimensional array element: arr[i][j] (1 identifier, multiple subscripts)
    if (ids.length === 1) {
      return AssignmentClassifier.classifyMultiDimArrayAccess(
        typeInfo,
        ctx.subscriptCount,
      );
    }

    return null;
  }

  /**
   * Classify multi-dimensional array access: arr[i][j] or arr[i][j][bit]
   */
  private static classifyMultiDimArrayAccess(
    typeInfo: TTypeInfo | undefined,
    subscriptCount: number,
  ): AssignmentKind | null {
    if (!typeInfo?.isArray || !typeInfo.arrayDimensions) {
      return null;
    }

    const numDims = typeInfo.arrayDimensions.length;

    // Check for bit indexing on array element
    if (
      subscriptCount === numDims + 1 &&
      TypeCheckUtils.isInteger(typeInfo.baseType)
    ) {
      return AssignmentKind.ARRAY_ELEMENT_BIT;
    }

    return AssignmentKind.MULTI_DIM_ARRAY_ELEMENT;
  }

  /**
   * ADR-004: a bit or bit range of a register member -- `R.M[b]`, a scope's
   * own bare `R.M[b]`, `this.R.M[b]`, `S.R.M[b]`, `global.R.M[b]` -- is the
   * typer's answer for the chain's last step: a subscript whose prefix is a
   * register member. The member's access decides the write, so how the
   * register was spelled must not (#2185: a bare in-scope `PWM.FLAGS[0]` on a
   * `w1c` member was read-modify-written).
   */
  private static classifyRegisterBit(
    ctx: IAssignmentContext,
  ): AssignmentKind | null {
    const step = ctx.target.last;
    if (!step?.beforeRegisterMember) {
      return null;
    }
    switch (step.subscript) {
      case "bit_single":
        return AssignmentKind.REGISTER_BIT;
      case "bit_range":
        return AssignmentKind.REGISTER_BIT_RANGE;
      default:
        return null;
    }
  }

  /**
   * Classify global.* and this.* prefix patterns.
   */
  private static classifyPrefixPattern(
    ctx: IAssignmentContext,
  ): AssignmentKind | null {
    if (!ctx.hasGlobal && !ctx.hasThis) {
      return null;
    }

    if (ctx.hasGlobal && ctx.postfixOpsCount > 0) {
      return AssignmentClassifier.classifyGlobalPrefix(ctx);
    }

    if (ctx.hasThis && ctx.postfixOpsCount > 0) {
      return AssignmentClassifier.classifyThisPrefix(ctx);
    }

    return null;
  }

  /**
   * Classify global.* patterns: global.reg[bit], global.arr[i], global.member
   */
  private static classifyGlobalPrefix(ctx: IAssignmentContext): AssignmentKind {
    const firstId = ctx.identifiers[0];

    if (ctx.hasArrayAccess) {
      // A register's bits (`global.REG.MEMBER[bit]`) were classified before
      // this, by the one rule every spelling takes (#1244, #2185).

      // Scope-qualified variable: global.Scope.member[...]. Shared with the
      // bare spelling — see classifyScopeQualifiedSubscript.
      const scopeQualifiedKind =
        AssignmentClassifier.classifyScopeQualifiedSubscript(
          ctx,
          "global.",
          false,
        );
      if (scopeQualifiedKind !== null) {
        return scopeQualifiedKind;
      }

      // Issue #1115: when the subscript applies to the named VARIABLE,
      // `global.x[...]` means exactly what `x[...]` means, so it makes the same
      // decision. This branch used to return GLOBAL_ARRAY for every non-register
      // target without consulting SubscriptClassifier at all, which emitted the
      // raw subscript chain and broke every operation:
      //   global.buf[3][1] <- true  ->  buf[3][1] = true      (indexes a u8)
      //   global.s[0, 4] <- magic   ->  s[0, 4] = magic       (C comma operator)
      //   global.f[4, 3] <- 5       ->  f[4, 3] = 5           (C comma operator)
      // Cross-scope visibility is still enforced: the check runs during
      // `generateAssignmentTarget` (MemberSeparatorResolver), not in the
      // GLOBAL_ARRAY handler, so it applies to the delegated kinds too.
      if (ctx.identifiers.length === 1) {
        return AssignmentClassifier.classifySubscriptAccess(
          ctx,
          `global.${firstId}`,
        );
      }

      // Member chain (`global.config.items[0].assigned`): the subscript applies
      // to a struct field, not to `config`, so the general variable-subscript
      // classification does not apply. Handled as a chain.
      return AssignmentKind.GLOBAL_ARRAY;
    }

    return AssignmentKind.GLOBAL_MEMBER;
  }

  /**
   * Decide a subscript chain whose base name is scope-qualified:
   * `Scope.member[...]`. A register's bits were classified before this, by
   * the typer's step (#2185).
   *
   * Issue #1244: the `global.` prefix is a grammar token, not an identifier, so
   * `global.Other.buffer[3]` and the bare `Other.buffer[3]` arrive with
   * identical `ctx.identifiers` and mean the same thing. They are therefore ONE
   * decision, made here for both spellings.
   *
   * The bare spelling used to reach none of this. It landed in
   * `classifyMemberWithSubscript`, which had no scope-resolution step at all,
   * so the struct-chain branch claimed every bit range before the register or
   * the variable was ever recognized — emitting `Hw_GPIO_Mode.GPIO.Mode`
   * (#1244), `Other_flags.flags` on a scalar (#1116), and a 4-byte slice copy
   * silently rewritten as a 4-bit mask/shift.
   *
   * The ADR-057 precondition lives HERE rather than in each caller. When it sat
   * in the callers, the bare one gated on a lookup that silently covered only
   * two of the three tiers, and the `global.` one gated on nothing — the two
   * spellings shared the mechanism while each derived its own entry condition,
   * which is the divergence this method exists to remove.
   *
   * @param displayPrefix Diagnostic prefix matching the spelling written
   * @param resolvesBareName Whether the base name goes through ADR-057's
   *        local -> scope -> global order. False for `global.`, which names the
   *        global tier outright and must not be shadowed by a nearer variable.
   * @returns null when the base is not a scope-qualified name, leaving the
   *          caller's remaining cases (member chains, plain globals) untouched
   */
  private static classifyScopeQualifiedSubscript(
    ctx: IAssignmentContext,
    displayPrefix: string,
    resolvesBareName: boolean,
  ): AssignmentKind | null {
    const ids = ctx.identifiers;
    const scopeName = ids[0];
    if (!ctx.state.isKnownScope(scopeName)) {
      return null;
    }

    // ADR-057: a variable of that name at any tier wins, so the target is a
    // struct chain rather than a scope reference -- the binder's local ->
    // scope -> global order, applied where the target is (#1668)
    if (resolvesBareName && ctx.target.rootTypeInfo !== undefined) {
      return null;
    }

    // Only the variable case remains: registers are decided by
    // classifyRegisterBit, which `classify` asks before this method.
    // Once `Scope.member` resolves, this is exactly the decision the bare
    // `member[...]` spelling makes, so it delegates rather than re-deriving it.
    if (ids.length === 2) {
      return AssignmentClassifier.classifySubscriptAccess(
        ctx,
        `${displayPrefix}${ids.join(".")}`,
      );
    }

    return null;
  }

  /**
   * Classify this.* patterns: this.arr[i], this.flags[bit], this.member. A
   * register's bits and a bitmap's fields were classified before this.
   */
  private static classifyThisPrefix(ctx: IAssignmentContext): AssignmentKind {
    if (ctx.scopePath && ctx.hasArrayAccess) {
      return AssignmentClassifier.classifyThisWithArrayAccess(ctx);
    }
    return AssignmentKind.THIS_MEMBER;
  }

  /**
   * Classify this.reg[bit] / this.arr[i] / this.flags[3] patterns with array access.
   * Issue #954: array vs bit access is the typer's subscript kind (#1668, C12).
   *
   * Issue #1115: this is the same decision the bare path makes, so it
   * delegates rather than re-deriving it — this method used to carry a
   * truncated copy of that switch, which silently lost ARRAY_ELEMENT_BIT,
   * ARRAY_SLICE, MULTI_DIM_ARRAY_ELEMENT and STRING_ARRAY_ELEMENT for `this.`
   * targets. A scope's register is no longer `this.`-specific either (#2185).
   */
  private static classifyThisWithArrayAccess(
    ctx: IAssignmentContext,
  ): AssignmentKind {
    // Diagnostics quote the source spelling (`this.flags`) rather than the
    // scope-qualified C name, so the suggested fix is the text the developer
    // actually wrote. (`Sensor_flags` does resolve as a bare name, but nobody
    // writes it — echoing it back would read as a different variable.)
    return AssignmentClassifier.classifySubscriptAccess(
      ctx,
      `this.${ctx.identifiers[0]}`,
    );
  }

  /**
   * Classify simple array/bit access (no prefix, no member access).
   * Pattern: arr[i] or flags[bit]
   *
   * Issue #579: the subscript's kind is the typer's, the same one the
   * expression path reads (#1668, C12).
   */
  private static classifyArrayOrBitAccess(
    ctx: IAssignmentContext,
  ): AssignmentKind | null {
    // Must have arrayAccess without memberAccess or prefix
    if (ctx.hasGlobal || ctx.hasThis || ctx.hasMemberAccess) {
      return null;
    }

    if (!ctx.hasArrayAccess || ctx.subscriptCount === 0) {
      return null;
    }

    const name = ctx.identifiers[0];
    return AssignmentClassifier.classifySubscriptAccess(ctx, name);
  }

  /**
   * Decide what a subscript chain on a single variable means.
   *
   * Issue #1115: the SINGLE source of truth for that decision. `arr[i]` and
   * `this.arr[i]` differ only in how the base name resolves — once resolved,
   * the type lookup, depth validation and array-vs-bit classification are
   * identical, and the handlers already share generation (THIS_BIT and
   * INTEGER_BIT both map to `handleIntegerBit`, since `resolvedTarget` and
   * `resolvedBaseIdentifier` already carry the scope prefix). Keeping two
   * copies of this switch is what let the `this.` form diverge.
   *
   * #1668 (C7): the variable is the target's binding, so its spelling no
   * longer matters here -- only the diagnostic's.
   *
   * @param displayName  Name for diagnostics: what the developer actually wrote
   */
  private static classifySubscriptAccess(
    ctx: IAssignmentContext,
    displayName: string,
  ): AssignmentKind {
    // A chain that ends in a member (`this.buffer[i].value`) writes that
    // member, and its subscripts index on the way there -- a member chain, as
    // the bare spelling `buffer[i].value` is. The rules below are about a
    // FINAL subscript; this reached them and was classified by the
    // classifier's default for an unknown type, whose handler wrote the right
    // text by coincidence (#1668 review).
    const last = ctx.target.last;
    if (last?.subscript === null) {
      return AssignmentKind.MEMBER_CHAIN;
    }

    const typeInfo = ctx.target.typeInfo ?? null;

    // `assignmentTarget` consumes the leading `IDENTIFIER` (and any `this .` /
    // `global .` prefix) in the grammar rule itself, so op 0 is a subscript for
    // `flags[4][3]`, `this.flags[4][3]` and `global.flags[4][3]` alike. Only a
    // scope-qualified chain such as `global.Other.buf[3][1]` carries extra
    // member ops first — exactly one per identifier past the base, hence
    // `identifiers.length - 1` for every spelling.
    const memberOpCount = ctx.identifiers.length - 1;

    // Issue #1106: reject over-indexing a scalar/array base (e.g. flags[4][3]
    // on a scalar u8). Counting is delegated to SubscriptDepthValidator so
    // this path and the read path share the decision, not just the check.
    SubscriptDepthValidator.validate(
      typeInfo ?? undefined,
      // #1445: counted off the PLANNED ops, which carry `kind` -- the node's
      // `expression().length` said the same thing and is no longer here.
      SubscriptDepthValidator.countLeadingSubscripts(
        ctx.postfixOps.slice(memberOpCount),
      ),
      displayName,
    );

    // #1668 (C12): what the final subscript reads, and so whether it is an
    // element, a slice, a bit or a bit range, is the one operand typer's
    // answer -- the one 2.1 already checked. Classifying from the ROOT's type
    // called `row[2][0, 4]` a slice of `row`, and a valid program failed with
    // an internal error. The typer types every subscript it walks, an
    // untyped value's included (the classifier's default for an unknown type).
    const subscriptKind = last?.subscript ?? null;
    invariant(
      subscriptKind !== null,
      "the typer typed this target's final subscript",
    );
    // The subscripts are flattened, so anything before the final op's own
    // expressions indexed an array element first
    const indexesAnElement = ctx.subscriptCount > ctx.lastSubscriptExprCount;

    switch (subscriptKind) {
      case "bit_single":
        if (!indexesAnElement) return AssignmentKind.INTEGER_BIT;
        // e.g. matrix[i][j][bit] on an integer array's element
        return OperandTyper.hasWritableBits(last?.before ?? null)
          ? AssignmentKind.ARRAY_ELEMENT_BIT
          : AssignmentKind.MULTI_DIM_ARRAY_ELEMENT;

      case "bit_range":
        return indexesAnElement
          ? AssignmentKind.ARRAY_ELEMENT_BIT_RANGE
          : AssignmentKind.INTEGER_BIT_RANGE;

      case "array_element":
        // Multi-dimensional array: matrix[i][j] has multiple subscript operations
        // but each with 1 expression (vs slice [0, 5] with 2 expressions in 1 op)
        if (ctx.subscriptCount > 1) {
          return AssignmentKind.MULTI_DIM_ARRAY_ELEMENT;
        }
        // String array element (special case for 2D string arrays)
        if (
          typeInfo?.isString &&
          typeInfo.arrayDimensions &&
          typeInfo.arrayDimensions.length > 1
        ) {
          return AssignmentKind.STRING_ARRAY_ELEMENT;
        }
        return AssignmentKind.ARRAY_ELEMENT;

      case "array_slice":
        return AssignmentKind.ARRAY_SLICE;
    }
  }

  /**
   * Classify atomic and overflow-clamped compound assignments. Atomics are
   * the writes 2.2 planned atomic, however the target spells them (#1179); a
   * clamp is any target that writes a `clamp` integer.
   */
  private static classifySpecialCompound(
    ctx: IAssignmentContext,
  ): AssignmentKind | null {
    if (!ctx.isCompound) {
      return null;
    }

    // ADR-049: 2.2 planned which writes are atomic read-modify-writes
    if (ctx.atomic !== null) {
      return AssignmentKind.ATOMIC_RMW;
    }

    if (AssignmentClassifier.compoundClamp(ctx) !== null) {
      return AssignmentKind.OVERFLOW_CLAMP;
    }

    return null;
  }

  /**
   * ADR-044: the saturating helper operation (`add`, `sub`, `mul`) that a
   * compound assignment lowers to, or null when it is plain C arithmetic.
   *
   * Only a `clamp` integer target qualifies, and only for the arithmetic
   * operators that can overflow; a bitwise compound cannot, so it stays plain.
   * This is the one decision: the classifier asks it to pick OVERFLOW_CLAMP,
   * the overflow handler asks it for the helper, and the atomic handler asks it
   * for the inner operation of its read-modify-write. The atomic generator used
   * to decide the same thing from its own operator map and its own integer test.
   *
   * #1668: null when the value has a floating operand. `y *<- 2.5` is
   * `y <- y * 2.5`, and routing it into `cnx_clamp_mul_u32` truncated the 2.5
   * to 2 before multiplying.
   *
   * `cnxType` is the type the helper saturates at: the written value's.
   */
  static compoundClamp(
    ctx: IAssignmentContext,
  ): { operation: string; cnxType: string } | null {
    return ctx.plannedClamp;
  }

  /**
   * 2.2's one decision behind `compoundClamp`: the helper a compound `cOp`
   * write to `target` calls, from the type the write stores
   */
  static clampOfWrite(
    target: IChainBase,
    isSimple: boolean,
    cnextOp: string,
    hasFloatingOperand: () => boolean,
  ): { operation: string; cnxType: string } | null {
    const written = AssignmentClassifier.writtenValue(target, isSimple);
    if (written === null) return null;
    return AssignmentClassifier.clampOf(
      written.baseType,
      written.overflowBehavior,
      cnextOp,
      hasFloatingOperand,
    );
  }

  /** ADR-044: the clamp helper a compound `cnextOp` write of this type calls, or null */
  static clampOf(
    baseType: string,
    overflowBehavior: TOverflowBehavior | null,
    cnextOp: string,
    hasFloatingOperand: () => boolean,
  ): { operation: string; cnxType: string } | null {
    if (overflowBehavior !== "clamp") return null;
    if (!TypeCheckUtils.isInteger(baseType)) return null;
    if (hasFloatingOperand()) return null;
    const operator = CompoundOperator.binaryOf(cnextOp);
    const operation =
      operator === null ? undefined : CLAMP_HELPER_FOR_OPERATOR[operator];
    return operation ? { operation, cnxType: baseType } : null;
  }

  /**
   * What the target writes, for ADR-044: its type and declared behavior.
   * #1411/#1887: a field (`p.x`) or an element (`levels[1]`) is written as
   * much as a variable is, so a chain's is the typer's last step -- the
   * field's own modifier, the element's array's. A target with no step is
   * the variable itself.
   */
  private static writtenValue(
    target: IChainBase,
    isSimple: boolean,
  ): { baseType: string; overflowBehavior: TOverflowBehavior | null } | null {
    const last = target.last;
    if (last === undefined) {
      const typeInfo = isSimple ? target.typeInfo : undefined;
      if (!typeInfo) return null;
      return {
        baseType: typeInfo.baseType,
        overflowBehavior: typeInfo.overflowBehavior ?? null,
      };
    }
    const after = last.after;
    if (after?.typeName == null || after.dimensions.length > 0) return null;
    return { baseType: after.typeName, overflowBehavior: after.overflow };
  }

  /**
   * Check if a simple identifier is a string variable.
   */
  private static _classifySimpleStringVar(
    ctx: IAssignmentContext,
  ): AssignmentKind | null {
    if (!ctx.isSimpleIdentifier) return null;
    const typeInfo = AssignmentClassifier.targetTypeInfo(ctx);
    return AssignmentClassifier.isSimpleStringType(typeInfo)
      ? AssignmentKind.STRING_SIMPLE
      : null;
  }

  /**
   * Check if this.member is a string.
   */
  private static _classifyThisMemberString(
    ctx: IAssignmentContext,
  ): AssignmentKind | null {
    if (!ctx.isSimpleThisAccess || !ctx.scopePath) return null;
    const typeInfo = AssignmentClassifier.targetTypeInfo(ctx);
    return AssignmentClassifier.isSimpleStringType(typeInfo)
      ? AssignmentKind.STRING_THIS_MEMBER
      : null;
  }

  /**
   * Check if global.member is a string.
   */
  private static _classifyGlobalString(
    ctx: IAssignmentContext,
  ): AssignmentKind | null {
    if (!ctx.isSimpleGlobalAccess) return null;
    const typeInfo = AssignmentClassifier.targetTypeInfo(ctx);
    return AssignmentClassifier.isSimpleStringType(typeInfo)
      ? AssignmentKind.STRING_GLOBAL
      : null;
  }

  /** Whether a chain's root is a variable of a known struct type */
  private static _isStructRoot(
    rootTypeInfo: TTypeInfo | undefined,
    ctx: IAssignmentContext,
  ): boolean {
    return (
      rootTypeInfo !== undefined &&
      ctx.state.isKnownStruct(rootTypeInfo.baseType)
    );
  }

  /**
   * `struct.field <- "…"` (no subscript) or `struct.arr[i] <- "…"` (one): a
   * two-name chain on a struct variable that writes one `string<N>`.
   *
   * #1737: whether the written value is a `string<N>`, and its capacity, are
   * the typer's last step, read once; this used to re-derive them from the
   * struct-field registry, the accessor beside it, and two maps beside that.
   */
  private static _writesStructString(
    ctx: IAssignmentContext,
    subscripts: number,
  ): boolean {
    return (
      ctx.hasMemberAccess &&
      ctx.identifiers.length === 2 &&
      ctx.subscriptCount === subscripts &&
      ctx.hasArrayAccess === subscripts > 0 &&
      AssignmentClassifier._isStructRoot(ctx.target.rootTypeInfo, ctx) &&
      OperandTyper.scalarStringCapacity(ctx.target.last?.after) !== null
    );
  }

  /**
   * Classify string assignments.
   */
  private static classifyStringAssignment(
    ctx: IAssignmentContext,
  ): AssignmentKind | null {
    // Simple string variable
    const simpleVar = AssignmentClassifier._classifySimpleStringVar(ctx);
    if (simpleVar) return simpleVar;

    // this.member string
    const thisMember = AssignmentClassifier._classifyThisMemberString(ctx);
    if (thisMember) return thisMember;

    // global.member string
    const globalMember = AssignmentClassifier._classifyGlobalString(ctx);
    if (globalMember) return globalMember;

    // struct.field or struct.arr[i] string
    if (AssignmentClassifier._writesStructString(ctx, 0)) {
      return AssignmentKind.STRING_STRUCT_FIELD;
    }
    if (AssignmentClassifier._writesStructString(ctx, 1)) {
      return AssignmentKind.STRING_STRUCT_ARRAY_ELEMENT;
    }

    return null;
  }
}

export default AssignmentClassifier;
