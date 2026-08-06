/**
 * Assignment classifier for dispatch-based code generation (ADR-109).
 *
 * Analyzes an assignment context and determines which AssignmentKind it is.
 * The classification order matches the original generateAssignment() method's
 * if-else chain to ensure identical behavior.
 *
 * Migrated to use CodeGenState instead of constructor DI.
 */
import AssignmentKind from "./AssignmentKind";
import IAssignmentContext from "./IAssignmentContext";
import CodeGenState from "../../../state/CodeGenState";
import SubscriptClassifier from "../subscript/SubscriptClassifier";
import SubscriptDepthValidator from "../subscript/SubscriptDepthValidator";
import TTypeInfo from "../types/TTypeInfo";
import TypeCheckUtils from "../../../../utils/TypeCheckUtils";
import QualifiedNameGenerator from "../utils/QualifiedNameGenerator";
import QualifiedCName from "../../../../utils/QualifiedCName";

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
  private static isSimpleStringType(typeInfo: TTypeInfo | undefined): boolean {
    return (
      typeInfo?.isString === true &&
      typeInfo.stringCapacity !== undefined &&
      (!typeInfo.arrayDimensions || typeInfo.arrayDimensions.length <= 1)
    );
  }

  /**
   * Extract struct name and field name from a 2-identifier context.
   */
  private static getStructFieldNames(
    ctx: IAssignmentContext,
  ): { structName: string; fieldName: string } | null {
    if (ctx.identifiers.length !== 2) {
      return null;
    }
    return { structName: ctx.identifiers[0], fieldName: ctx.identifiers[1] };
  }

  /**
   * Classify an assignment context into an AssignmentKind.
   */
  static classify(ctx: IAssignmentContext): AssignmentKind {
    // === Priority 1: Bitmap field assignments ===
    const bitmapKind = AssignmentClassifier.classifyBitmapField(ctx);
    if (bitmapKind !== null) {
      return bitmapKind;
    }

    // === Priority 2: Member access with subscripts (arrays, register bits) ===
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

    // === Priority 5: Atomic/overflow compound assignments ===
    const specialKind = AssignmentClassifier.classifySpecialCompound(ctx);
    if (specialKind !== null) {
      return specialKind;
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
   * Classify bitmap field assignments.
   * Patterns: var.field, struct.bitmapMember.field, REG.MEMBER.field, Scope.REG.MEMBER.field
   */
  private static classifyBitmapField(
    ctx: IAssignmentContext,
  ): AssignmentKind | null {
    // Must have member access without subscripts
    if (!ctx.hasMemberAccess || ctx.hasArrayAccess) {
      return null;
    }

    const ids = ctx.identifiers;
    if (ctx.subscripts.length !== 0) {
      return null;
    }

    if (ids.length === 2) {
      return AssignmentClassifier.classifySimpleBitmapField(ids[0], ids[1]);
    }

    if (ids.length === 3) {
      return AssignmentClassifier.classifyThreeIdBitmapField(
        ids[0],
        ids[1],
        ids[2],
      );
    }

    if (ids.length === 4) {
      return AssignmentClassifier.classifyScopedRegisterBitmapField(ids);
    }

    return null;
  }

  /**
   * Classify 2-id bitmap field: var.field
   */
  private static classifySimpleBitmapField(
    varName: string,
    fieldName: string,
  ): AssignmentKind | null {
    const typeInfo = CodeGenState.getVariableTypeInfo(varName);
    if (!typeInfo?.isBitmap || !typeInfo.bitmapTypeName) {
      return null;
    }

    const width = AssignmentClassifier.lookupBitmapFieldWidth(
      typeInfo.bitmapTypeName,
      fieldName,
    );
    if (width === null) {
      return null;
    }

    return width === 1
      ? AssignmentKind.BITMAP_FIELD_SINGLE_BIT
      : AssignmentKind.BITMAP_FIELD_MULTI_BIT;
  }

  /**
   * Classify 3-id bitmap field: REG.MEMBER.field or struct.bitmapMember.field
   */
  private static classifyThreeIdBitmapField(
    firstName: string,
    secondName: string,
    fieldName: string,
  ): AssignmentKind | null {
    // Check if register member bitmap field: REG.MEMBER.field
    if (CodeGenState.symbols!.knownRegisters.has(firstName)) {
      const bitmapType = AssignmentClassifier.lookupRegisterMemberBitmapType(
        firstName,
        secondName,
      );
      if (bitmapType) {
        const width = AssignmentClassifier.lookupBitmapFieldWidth(
          bitmapType,
          fieldName,
        );
        if (width !== null) {
          return AssignmentKind.REGISTER_MEMBER_BITMAP_FIELD;
        }
      }
      return null;
    }

    // Check if struct member bitmap field: struct.bitmapMember.field
    const structTypeInfo = CodeGenState.getVariableTypeInfo(firstName);
    if (
      !structTypeInfo ||
      !CodeGenState.isKnownStruct(structTypeInfo.baseType)
    ) {
      return null;
    }

    const memberInfo = CodeGenState.getMemberTypeInfo(
      structTypeInfo.baseType,
      secondName,
    );
    if (!memberInfo) {
      return null;
    }

    const width = AssignmentClassifier.lookupBitmapFieldWidth(
      memberInfo.baseType,
      fieldName,
    );
    if (width !== null) {
      return AssignmentKind.STRUCT_MEMBER_BITMAP_FIELD;
    }

    return null;
  }

  /**
   * Classify 4-id scoped register bitmap field: Scope.REG.MEMBER.field
   */
  private static classifyScopedRegisterBitmapField(
    ids: readonly string[],
  ): AssignmentKind | null {
    const scopeName = ids[0];
    if (!CodeGenState.isKnownScope(scopeName)) {
      return null;
    }

    const fullRegName = QualifiedNameGenerator.forMember(scopeName, ids[1]);
    if (!CodeGenState.symbols!.knownRegisters.has(fullRegName)) {
      return null;
    }

    const bitmapType = AssignmentClassifier.lookupRegisterMemberBitmapType(
      fullRegName,
      ids[2],
    );
    if (!bitmapType) {
      return null;
    }

    const width = AssignmentClassifier.lookupBitmapFieldWidth(
      bitmapType,
      ids[3],
    );
    if (width !== null) {
      return AssignmentKind.SCOPED_REGISTER_MEMBER_BITMAP_FIELD;
    }

    return null;
  }

  /**
   * Classify member access with subscripts.
   * Patterns: arr[i][j], struct.arr[i], REG.MEMBER[bit], matrix[i][j][bit]
   */
  private static classifyMemberWithSubscript(
    ctx: IAssignmentContext,
  ): AssignmentKind | null {
    // Need subscripts through memberAccess pattern
    if (!ctx.hasMemberAccess || ctx.subscripts.length === 0) {
      return null;
    }

    // Skip this.* and global.* patterns - they're handled by classifyPrefixPattern
    if (ctx.hasThis || ctx.hasGlobal) {
      return null;
    }

    const ids = ctx.identifiers;
    const firstId = ids[0];
    const typeInfo = CodeGenState.getVariableTypeInfo(firstId);

    // Check for bit range through struct chain: devices[0].control[0, 4]
    // Detected by last subscript having 2 expressions (start, width)
    if (ctx.lastSubscriptExprCount === 2) {
      return AssignmentKind.STRUCT_CHAIN_BIT_RANGE;
    }

    // Multi-dimensional array element: arr[i][j] (1 identifier, multiple subscripts)
    if (ids.length === 1) {
      return AssignmentClassifier.classifyMultiDimArrayAccess(
        typeInfo,
        ctx.subscripts.length,
      );
    }

    // 2+ identifiers with subscripts: register bit or bitmap array
    if (ids.length >= 2) {
      const registerKind = AssignmentClassifier.classifyRegisterBitAccess(
        ids,
        ctx.subscripts.length,
      );
      if (registerKind !== null) {
        return registerKind;
      }

      return AssignmentClassifier.classifyBitmapArrayField(
        ids[1],
        typeInfo,
        ctx.subscripts.length,
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
   * Classify register bit access: REG.MEMBER[bit] or Scope.REG.MEMBER[bit]
   */
  private static classifyRegisterBitAccess(
    ids: readonly string[],
    subscriptCount: number,
  ): AssignmentKind | null {
    const firstId = ids[0];

    // Check for scoped register: Scope.REG.MEMBER[bit]
    if (CodeGenState.isKnownScope(firstId) && ids.length >= 3) {
      const scopedRegName = QualifiedCName.join(firstId, ids[1]);
      if (CodeGenState.symbols!.knownRegisters.has(scopedRegName)) {
        return subscriptCount === 2
          ? AssignmentKind.REGISTER_BIT_RANGE
          : AssignmentKind.REGISTER_BIT;
      }
    }

    // Check for non-scoped register: REG.MEMBER[bit]
    if (CodeGenState.symbols!.knownRegisters.has(firstId)) {
      return subscriptCount === 2
        ? AssignmentKind.REGISTER_BIT_RANGE
        : AssignmentKind.REGISTER_BIT;
    }

    return null;
  }

  /**
   * Classify bitmap array element field: bitmapArr[i].field
   */
  private static classifyBitmapArrayField(
    secondId: string,
    typeInfo: TTypeInfo | undefined,
    subscriptCount: number,
  ): AssignmentKind | null {
    if (subscriptCount !== 1) {
      return null;
    }

    if (!typeInfo?.isBitmap || !typeInfo.isArray || !typeInfo.bitmapTypeName) {
      return null;
    }

    const width = AssignmentClassifier.lookupBitmapFieldWidth(
      typeInfo.bitmapTypeName,
      secondId,
    );
    if (width !== null) {
      return AssignmentKind.BITMAP_ARRAY_ELEMENT_FIELD;
    }

    return null;
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
      // Direct register: global.REG.MEMBER[bit]
      if (CodeGenState.symbols!.knownRegisters.has(firstId)) {
        return AssignmentKind.GLOBAL_REGISTER_BIT;
      }
      // Scoped register: global.Scope.REG.MEMBER[bit] — mirror
      // classifyRegisterBitAccess so the bit-range mask/shift is expanded
      // rather than emitting a literal subscript (Issue #1052).
      if (
        CodeGenState.isKnownScope(firstId) &&
        ctx.identifiers.length >= 3 &&
        CodeGenState.symbols!.knownRegisters.has(
          QualifiedCName.join(firstId, ctx.identifiers[1]),
        )
      ) {
        return AssignmentKind.GLOBAL_REGISTER_BIT;
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
      const resolvedName = AssignmentClassifier.resolveGlobalVariableName(ctx);
      if (resolvedName !== null) {
        return AssignmentClassifier.classifySubscriptAccess(
          ctx,
          resolvedName,
          `global.${ctx.identifiers.join(".")}`,
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
   * Name of the variable a `global.` target subscripts, or null when the target
   * is a member chain and the subscript belongs to a field rather than to the
   * named variable.
   *
   * `global.x[i]` -> `x`; `global.Scope.member[i]` -> `Scope_member`;
   * `global.obj.field[i]` -> null (subscript applies to `field`).
   */
  private static resolveGlobalVariableName(
    ctx: IAssignmentContext,
  ): string | null {
    const firstId = ctx.identifiers[0];
    if (ctx.identifiers.length === 1) {
      return firstId;
    }
    if (ctx.identifiers.length === 2 && CodeGenState.isKnownScope(firstId)) {
      return QualifiedCName.join(firstId, ctx.identifiers[1]);
    }
    return null;
  }

  /**
   * Classify this.* patterns: this.reg[bit], this.member, this.REG.MEMBER.field
   */
  private static classifyThisPrefix(ctx: IAssignmentContext): AssignmentKind {
    if (!CodeGenState.currentScope) {
      return AssignmentKind.THIS_MEMBER;
    }

    const firstId = ctx.identifiers[0];
    const scopedRegName = QualifiedCName.join(
      CodeGenState.currentScope,
      firstId,
    );

    if (ctx.hasArrayAccess) {
      return AssignmentClassifier.classifyThisWithArrayAccess(
        ctx,
        scopedRegName,
      );
    }

    // this.REG.MEMBER.field (scoped register bitmap field)
    if (
      ctx.identifiers.length === 3 &&
      CodeGenState.symbols!.knownRegisters.has(scopedRegName)
    ) {
      const bitmapType = AssignmentClassifier.lookupRegisterMemberBitmapType(
        scopedRegName,
        ctx.identifiers[1],
      );
      if (bitmapType) {
        return AssignmentKind.SCOPED_REGISTER_MEMBER_BITMAP_FIELD;
      }
    }

    return AssignmentKind.THIS_MEMBER;
  }

  /**
   * Classify this.reg[bit] / this.arr[i] / this.flags[3] patterns with array access.
   * Issue #954: Uses SubscriptClassifier to distinguish array vs bit access.
   *
   * Issue #1115: only the scoped-register check is `this.`-specific. Everything
   * after it is the same decision the bare path makes, so it delegates rather
   * than re-deriving it — this method used to carry a truncated copy of that
   * switch, which silently lost ARRAY_ELEMENT_BIT, ARRAY_SLICE,
   * MULTI_DIM_ARRAY_ELEMENT and STRING_ARRAY_ELEMENT for `this.` targets.
   */
  private static classifyThisWithArrayAccess(
    ctx: IAssignmentContext,
    scopedRegName: string,
  ): AssignmentKind {
    // Check for scoped register first
    if (CodeGenState.symbols!.knownRegisters.has(scopedRegName)) {
      const hasBitRange = ctx.postfixOps.some((op) => op.COMMA() !== null);
      return hasBitRange
        ? AssignmentKind.SCOPED_REGISTER_BIT_RANGE
        : AssignmentKind.SCOPED_REGISTER_BIT;
    }

    // Diagnostics quote the source spelling (`this.flags`) rather than the
    // resolved `scopedRegName`, so the suggested fix is the text the developer
    // actually wrote. (`Sensor_flags` does resolve as a bare name, but nobody
    // writes it — echoing it back would read as a different variable.)
    return AssignmentClassifier.classifySubscriptAccess(
      ctx,
      scopedRegName,
      `this.${ctx.identifiers[0]}`,
    );
  }

  /**
   * Classify simple array/bit access (no prefix, no member access).
   * Pattern: arr[i] or flags[bit]
   *
   * Issue #579: Uses shared SubscriptClassifier to ensure consistent behavior
   * with the expression path in CodeGenerator._generatePostfixExpr.
   */
  private static classifyArrayOrBitAccess(
    ctx: IAssignmentContext,
  ): AssignmentKind | null {
    // Must have arrayAccess without memberAccess or prefix
    if (ctx.hasGlobal || ctx.hasThis || ctx.hasMemberAccess) {
      return null;
    }

    if (!ctx.hasArrayAccess || ctx.subscripts.length === 0) {
      return null;
    }

    const name = ctx.identifiers[0];
    return AssignmentClassifier.classifySubscriptAccess(ctx, name, name);
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
   * @param resolvedName Name for type lookup: `flags`, or `Scope_flags` for `this.`
   * @param displayName  Name for diagnostics: what the developer actually wrote
   */
  private static classifySubscriptAccess(
    ctx: IAssignmentContext,
    resolvedName: string,
    displayName: string,
  ): AssignmentKind {
    const typeInfo = CodeGenState.getVariableTypeInfo(resolvedName) ?? null;

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
      SubscriptDepthValidator.countLeadingSubscripts(
        ctx.postfixOps,
        memberOpCount,
      ),
      displayName,
      ctx.targetCtx.start?.line ?? 0,
    );

    // Use shared classifier for array vs bit access decision
    // Use lastSubscriptExprCount to distinguish [0][0] (two ops, each 1 expr)
    // from [0, 5] (one op, 2 exprs)
    const subscriptKind = SubscriptClassifier.classify({
      typeInfo,
      subscriptCount: ctx.lastSubscriptExprCount,
      isRegisterAccess: false,
    });

    switch (subscriptKind) {
      case "array_element":
        // Multi-dimensional array: matrix[i][j] has multiple subscript operations
        // but each with 1 expression (vs slice [0, 5] with 2 expressions in 1 op)
        if (ctx.subscripts.length > 1) {
          // Check if last subscript is bit access on an integer array element
          // e.g., matrix[i][j][bit] where matrix is 2D integer array
          const numDims = typeInfo?.arrayDimensions?.length ?? 0;
          if (
            ctx.subscripts.length === numDims + 1 &&
            typeInfo &&
            TypeCheckUtils.isInteger(typeInfo.baseType)
          ) {
            return AssignmentKind.ARRAY_ELEMENT_BIT;
          }
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

      case "bit_single":
        return AssignmentKind.INTEGER_BIT;

      case "bit_range":
        return AssignmentKind.INTEGER_BIT_RANGE;
    }
  }

  /**
   * Classify atomic and overflow-clamped compound assignments.
   * Handles simple identifiers, this.member, and global.member patterns.
   */
  private static classifySpecialCompound(
    ctx: IAssignmentContext,
  ): AssignmentKind | null {
    if (!ctx.isCompound) {
      return null;
    }

    // Get typeInfo based on target pattern
    let typeInfo;
    if (ctx.isSimpleIdentifier) {
      const id = ctx.identifiers[0];
      typeInfo = CodeGenState.getVariableTypeInfo(id);
    } else if (ctx.isSimpleThisAccess && CodeGenState.currentScope) {
      // this.member pattern: lookup using scoped name
      const memberName = ctx.identifiers[0];
      const scopedName = QualifiedCName.join(
        CodeGenState.currentScope,
        memberName,
      );
      typeInfo = CodeGenState.getVariableTypeInfo(scopedName);
    } else if (ctx.isSimpleGlobalAccess) {
      // global.member pattern: lookup using direct name
      const memberName = ctx.identifiers[0];
      typeInfo = CodeGenState.getVariableTypeInfo(memberName);
    } else {
      return null;
    }

    if (!typeInfo) {
      return null;
    }

    // Atomic RMW - for global atomic variables (simple identifiers or global.member)
    // Scoped atomics (this.member) use overflow behavior, not LDREX/STREX
    const isGlobalAtomic =
      typeInfo.isAtomic && (ctx.isSimpleIdentifier || ctx.isSimpleGlobalAccess);
    if (isGlobalAtomic) {
      return AssignmentKind.ATOMIC_RMW;
    }

    // Overflow clamp (integers only, not floats)
    // Only applies to arithmetic compound ops (+= -= *=) which can overflow
    // Bitwise ops (&= |= ^= <<= >>=) don't overflow, so they go to SIMPLE
    const ARITHMETIC_COMPOUND_OPS = new Set(["+=", "-=", "*="]);
    if (
      typeInfo.overflowBehavior === "clamp" &&
      TypeCheckUtils.isInteger(typeInfo.baseType) &&
      ARITHMETIC_COMPOUND_OPS.has(ctx.cOp)
    ) {
      return AssignmentKind.OVERFLOW_CLAMP;
    }

    return null;
  }

  /**
   * Check if a simple identifier is a string variable.
   */
  private static _classifySimpleStringVar(
    ctx: IAssignmentContext,
  ): AssignmentKind | null {
    if (!ctx.isSimpleIdentifier) return null;
    const id = ctx.identifiers[0];
    const typeInfo = CodeGenState.getVariableTypeInfo(id);
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
    if (!ctx.isSimpleThisAccess || !CodeGenState.currentScope) return null;
    const memberName = ctx.identifiers[0];
    const scopedName = QualifiedCName.join(
      CodeGenState.currentScope,
      memberName,
    );
    const typeInfo = CodeGenState.getVariableTypeInfo(scopedName);
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
    const id = ctx.identifiers[0];
    const typeInfo = CodeGenState.getVariableTypeInfo(id);
    return AssignmentClassifier.isSimpleStringType(typeInfo)
      ? AssignmentKind.STRING_GLOBAL
      : null;
  }

  /**
   * Resolve struct type from variable name.
   * Returns the base struct type if valid, null if not a known struct.
   */
  private static _resolveStructType(structName: string): string | null {
    const structTypeInfo = CodeGenState.getVariableTypeInfo(structName);
    if (
      !structTypeInfo ||
      !CodeGenState.isKnownStruct(structTypeInfo.baseType)
    ) {
      return null;
    }
    return structTypeInfo.baseType;
  }

  /**
   * Resolve struct field type from struct variable name and field name.
   * Returns null if struct type can't be resolved or field doesn't exist.
   */
  private static _resolveStructFieldType(structFieldNames: {
    structName: string;
    fieldName: string;
  }): { structType: string; fieldType: string | undefined } | null {
    const structType = AssignmentClassifier._resolveStructType(
      structFieldNames.structName,
    );
    if (!structType) {
      return null;
    }
    // Issue #831: Use SymbolTable as single source of truth for struct fields
    const fieldType = CodeGenState.symbolTable?.getStructFieldType(
      structType,
      structFieldNames.fieldName,
    );
    return { structType, fieldType };
  }

  /**
   * Check if struct.field is a string field.
   */
  private static _classifyStructFieldString(
    ctx: IAssignmentContext,
    structFieldNames: { structName: string; fieldName: string } | null,
  ): AssignmentKind | null {
    if (!ctx.hasMemberAccess || ctx.hasArrayAccess || !structFieldNames) {
      return null;
    }
    const resolved =
      AssignmentClassifier._resolveStructFieldType(structFieldNames);
    if (!resolved) {
      return null;
    }
    return resolved.fieldType && TypeCheckUtils.isString(resolved.fieldType)
      ? AssignmentKind.STRING_STRUCT_FIELD
      : null;
  }

  /**
   * Check if struct.arr[i] is a string array element.
   */
  private static _classifyStructArrayElementString(
    ctx: IAssignmentContext,
    structFieldNames: { structName: string; fieldName: string } | null,
  ): AssignmentKind | null {
    if (
      !ctx.hasMemberAccess ||
      !ctx.hasArrayAccess ||
      !structFieldNames ||
      ctx.subscripts.length !== 1
    ) {
      return null;
    }
    const resolved =
      AssignmentClassifier._resolveStructFieldType(structFieldNames);
    if (!resolved) {
      return null;
    }

    const { structType, fieldType } = resolved;
    const { fieldName } = structFieldNames;
    const fieldArrays = CodeGenState.symbols!.structFieldArrays.get(structType);
    const dimensions =
      CodeGenState.symbols!.structFieldDimensions.get(structType)?.get(
        fieldName,
      );

    const isStringArrayField =
      fieldType &&
      TypeCheckUtils.isString(fieldType) &&
      fieldArrays?.has(fieldName) &&
      dimensions &&
      dimensions.length >= 1;

    return isStringArrayField
      ? AssignmentKind.STRING_STRUCT_ARRAY_ELEMENT
      : null;
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
    const structFieldNames = AssignmentClassifier.getStructFieldNames(ctx);
    const structField = AssignmentClassifier._classifyStructFieldString(
      ctx,
      structFieldNames,
    );
    if (structField) return structField;

    const structArrayElement =
      AssignmentClassifier._classifyStructArrayElementString(
        ctx,
        structFieldNames,
      );
    if (structArrayElement) return structArrayElement;

    return null;
  }

  /**
   * Look up a bitmap field's width by bitmap type name and field name.
   * Returns the field width if found, or null if the bitmap/field doesn't exist.
   */
  private static lookupBitmapFieldWidth(
    bitmapTypeName: string,
    fieldName: string,
  ): number | null {
    const fields = CodeGenState.symbols!.bitmapFields.get(bitmapTypeName);
    if (fields?.has(fieldName)) {
      return fields.get(fieldName)!.width;
    }
    return null;
  }

  /**
   * Look up the bitmap type for a register member (e.g., "REG_MEMBER" -> "BitmapType").
   * Returns the bitmap type name if found, or null.
   */
  private static lookupRegisterMemberBitmapType(
    registerName: string,
    memberName: string,
  ): string | null {
    const key = QualifiedCName.join(registerName, memberName);
    return CodeGenState.symbols!.registerMemberTypes.get(key) ?? null;
  }
}

export default AssignmentClassifier;
