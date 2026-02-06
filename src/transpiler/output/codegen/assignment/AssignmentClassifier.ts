/**
 * Assignment classifier for dispatch-based code generation (ADR-109).
 *
 * Analyzes an assignment context and determines which AssignmentKind it is.
 * The classification order matches the original generateAssignment() method's
 * if-else chain to ensure identical behavior.
 */
import AssignmentKind from "./AssignmentKind";
import IAssignmentContext from "./IAssignmentContext";
import ICodeGenSymbols from "../../../types/ICodeGenSymbols";
import SubscriptClassifier from "../subscript/SubscriptClassifier";
import TTypeInfo from "../types/TTypeInfo";
import TypeCheckUtils from "../../../../utils/TypeCheckUtils";

/**
 * Dependencies for classification.
 */
interface IClassifierDeps {
  /** Symbol information (registers, bitmaps, structs, etc.) */
  readonly symbols: ICodeGenSymbols;

  /** Type registry: variable name -> type info */
  readonly typeRegistry: ReadonlyMap<string, TTypeInfo>;

  /** Current scope name, null if not in scope */
  readonly currentScope: string | null;

  /** Check if a type name is a known struct */
  isKnownStruct(typeName: string): boolean;

  /** Check if a name is a known scope */
  isKnownScope(name: string): boolean;

  /** Get member type info for a struct field */
  getMemberTypeInfo(structType: string, memberName: string): TTypeInfo | null;
}

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
  constructor(private readonly deps: IClassifierDeps) {}

  /**
   * Check if typeInfo represents a simple string type (not a 2D+ string array).
   */
  private isSimpleStringType(typeInfo: TTypeInfo | undefined): boolean {
    return (
      typeInfo?.isString === true &&
      typeInfo.stringCapacity !== undefined &&
      (!typeInfo.arrayDimensions || typeInfo.arrayDimensions.length <= 1)
    );
  }

  /**
   * Extract struct name and field name from a 2-identifier context.
   */
  private getStructFieldNames(
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
  classify(ctx: IAssignmentContext): AssignmentKind {
    // === Priority 1: Bitmap field assignments ===
    const bitmapKind = this.classifyBitmapField(ctx);
    if (bitmapKind !== null) {
      return bitmapKind;
    }

    // === Priority 2: Member access with subscripts (arrays, register bits) ===
    const memberSubscriptKind = this.classifyMemberWithSubscript(ctx);
    if (memberSubscriptKind !== null) {
      return memberSubscriptKind;
    }

    // === Priority 3: Global/this prefix patterns ===
    const prefixKind = this.classifyPrefixPattern(ctx);
    if (prefixKind !== null) {
      return prefixKind;
    }

    // === Priority 4: Simple array/bit access ===
    const arrayBitKind = this.classifyArrayOrBitAccess(ctx);
    if (arrayBitKind !== null) {
      return arrayBitKind;
    }

    // === Priority 5: Atomic/overflow compound assignments ===
    const specialKind = this.classifySpecialCompound(ctx);
    if (specialKind !== null) {
      return specialKind;
    }

    // === Priority 6: String assignments ===
    const stringKind = this.classifyStringAssignment(ctx);
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
  private classifyBitmapField(ctx: IAssignmentContext): AssignmentKind | null {
    // Must have member access without subscripts
    if (!ctx.hasMemberAccess || ctx.hasArrayAccess) {
      return null;
    }

    const ids = ctx.identifiers;
    if (ctx.subscripts.length !== 0) {
      return null;
    }

    if (ids.length === 2) {
      return this.classifySimpleBitmapField(ids[0], ids[1]);
    }

    if (ids.length === 3) {
      return this.classifyThreeIdBitmapField(ids[0], ids[1], ids[2]);
    }

    if (ids.length === 4) {
      return this.classifyScopedRegisterBitmapField(ids);
    }

    return null;
  }

  /**
   * Classify 2-id bitmap field: var.field
   */
  private classifySimpleBitmapField(
    varName: string,
    fieldName: string,
  ): AssignmentKind | null {
    const typeInfo = this.deps.typeRegistry.get(varName);
    if (!typeInfo?.isBitmap || !typeInfo.bitmapTypeName) {
      return null;
    }

    const width = this.lookupBitmapFieldWidth(
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
  private classifyThreeIdBitmapField(
    firstName: string,
    secondName: string,
    fieldName: string,
  ): AssignmentKind | null {
    // Check if register member bitmap field: REG.MEMBER.field
    if (this.deps.symbols.knownRegisters.has(firstName)) {
      const bitmapType = this.lookupRegisterMemberBitmapType(
        firstName,
        secondName,
      );
      if (bitmapType) {
        const width = this.lookupBitmapFieldWidth(bitmapType, fieldName);
        if (width !== null) {
          return AssignmentKind.REGISTER_MEMBER_BITMAP_FIELD;
        }
      }
      return null;
    }

    // Check if struct member bitmap field: struct.bitmapMember.field
    const structTypeInfo = this.deps.typeRegistry.get(firstName);
    if (!structTypeInfo || !this.deps.isKnownStruct(structTypeInfo.baseType)) {
      return null;
    }

    const memberInfo = this.deps.getMemberTypeInfo(
      structTypeInfo.baseType,
      secondName,
    );
    if (!memberInfo) {
      return null;
    }

    const width = this.lookupBitmapFieldWidth(memberInfo.baseType, fieldName);
    if (width !== null) {
      return AssignmentKind.STRUCT_MEMBER_BITMAP_FIELD;
    }

    return null;
  }

  /**
   * Classify 4-id scoped register bitmap field: Scope.REG.MEMBER.field
   */
  private classifyScopedRegisterBitmapField(
    ids: readonly string[],
  ): AssignmentKind | null {
    const scopeName = ids[0];
    if (!this.deps.isKnownScope(scopeName)) {
      return null;
    }

    const fullRegName = `${scopeName}_${ids[1]}`;
    if (!this.deps.symbols.knownRegisters.has(fullRegName)) {
      return null;
    }

    const bitmapType = this.lookupRegisterMemberBitmapType(fullRegName, ids[2]);
    if (!bitmapType) {
      return null;
    }

    const width = this.lookupBitmapFieldWidth(bitmapType, ids[3]);
    if (width !== null) {
      return AssignmentKind.SCOPED_REGISTER_MEMBER_BITMAP_FIELD;
    }

    return null;
  }

  /**
   * Classify member access with subscripts.
   * Patterns: arr[i][j], struct.arr[i], REG.MEMBER[bit], matrix[i][j][bit]
   */
  private classifyMemberWithSubscript(
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
    const typeInfo = this.deps.typeRegistry.get(firstId);

    // Multi-dimensional array element: arr[i][j] (1 identifier, multiple subscripts)
    if (ids.length === 1) {
      return this.classifyMultiDimArrayAccess(typeInfo, ctx.subscripts.length);
    }

    // 2+ identifiers with subscripts: register bit or bitmap array
    if (ids.length >= 2) {
      const registerKind = this.classifyRegisterBitAccess(
        ids,
        ctx.subscripts.length,
      );
      if (registerKind !== null) {
        return registerKind;
      }

      return this.classifyBitmapArrayField(
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
  private classifyMultiDimArrayAccess(
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
  private classifyRegisterBitAccess(
    ids: readonly string[],
    subscriptCount: number,
  ): AssignmentKind | null {
    const firstId = ids[0];

    // Check for scoped register: Scope.REG.MEMBER[bit]
    if (this.deps.isKnownScope(firstId) && ids.length >= 3) {
      const scopedRegName = `${firstId}_${ids[1]}`;
      if (this.deps.symbols.knownRegisters.has(scopedRegName)) {
        return subscriptCount === 2
          ? AssignmentKind.REGISTER_BIT_RANGE
          : AssignmentKind.REGISTER_BIT;
      }
    }

    // Check for non-scoped register: REG.MEMBER[bit]
    if (this.deps.symbols.knownRegisters.has(firstId)) {
      return subscriptCount === 2
        ? AssignmentKind.REGISTER_BIT_RANGE
        : AssignmentKind.REGISTER_BIT;
    }

    return null;
  }

  /**
   * Classify bitmap array element field: bitmapArr[i].field
   */
  private classifyBitmapArrayField(
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

    const width = this.lookupBitmapFieldWidth(
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
  private classifyPrefixPattern(
    ctx: IAssignmentContext,
  ): AssignmentKind | null {
    if (!ctx.hasGlobal && !ctx.hasThis) {
      return null;
    }

    if (ctx.hasGlobal && ctx.postfixOpsCount > 0) {
      return this.classifyGlobalPrefix(ctx);
    }

    if (ctx.hasThis && ctx.postfixOpsCount > 0) {
      return this.classifyThisPrefix(ctx);
    }

    return null;
  }

  /**
   * Classify global.* patterns: global.reg[bit], global.arr[i], global.member
   */
  private classifyGlobalPrefix(ctx: IAssignmentContext): AssignmentKind {
    const firstId = ctx.identifiers[0];

    if (ctx.hasArrayAccess) {
      if (this.deps.symbols.knownRegisters.has(firstId)) {
        return AssignmentKind.GLOBAL_REGISTER_BIT;
      }
      return AssignmentKind.GLOBAL_ARRAY;
    }

    return AssignmentKind.GLOBAL_MEMBER;
  }

  /**
   * Classify this.* patterns: this.reg[bit], this.member, this.REG.MEMBER.field
   */
  private classifyThisPrefix(ctx: IAssignmentContext): AssignmentKind {
    if (!this.deps.currentScope) {
      return AssignmentKind.THIS_MEMBER;
    }

    const firstId = ctx.identifiers[0];
    const scopedRegName = `${this.deps.currentScope}_${firstId}`;

    if (ctx.hasArrayAccess) {
      return this.classifyThisWithArrayAccess(ctx, scopedRegName);
    }

    // this.REG.MEMBER.field (scoped register bitmap field)
    if (
      ctx.identifiers.length === 3 &&
      this.deps.symbols.knownRegisters.has(scopedRegName)
    ) {
      const bitmapType = this.lookupRegisterMemberBitmapType(
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
   * Classify this.reg[bit] / this.arr[i] patterns with array access.
   */
  private classifyThisWithArrayAccess(
    ctx: IAssignmentContext,
    scopedRegName: string,
  ): AssignmentKind {
    if (this.deps.symbols.knownRegisters.has(scopedRegName)) {
      const hasBitRange = ctx.postfixOps.some((op) => op.COMMA() !== null);
      return hasBitRange
        ? AssignmentKind.SCOPED_REGISTER_BIT_RANGE
        : AssignmentKind.SCOPED_REGISTER_BIT;
    }
    return AssignmentKind.THIS_ARRAY;
  }

  /**
   * Classify simple array/bit access (no prefix, no member access).
   * Pattern: arr[i] or flags[bit]
   *
   * Issue #579: Uses shared SubscriptClassifier to ensure consistent behavior
   * with the expression path in CodeGenerator._generatePostfixExpr.
   */
  private classifyArrayOrBitAccess(
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
    const typeInfo = this.deps.typeRegistry.get(name) ?? null;

    // Use shared classifier for array vs bit access decision
    const subscriptKind = SubscriptClassifier.classify({
      typeInfo,
      subscriptCount: ctx.subscripts.length,
      isRegisterAccess: false,
    });

    switch (subscriptKind) {
      case "array_element":
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
  private classifySpecialCompound(
    ctx: IAssignmentContext,
  ): AssignmentKind | null {
    if (!ctx.isCompound) {
      return null;
    }

    // Get typeInfo based on target pattern
    let typeInfo;
    if (ctx.isSimpleIdentifier) {
      const id = ctx.identifiers[0];
      typeInfo = this.deps.typeRegistry.get(id);
    } else if (ctx.isSimpleThisAccess && this.deps.currentScope) {
      // this.member pattern: lookup using scoped name
      const memberName = ctx.identifiers[0];
      const scopedName = `${this.deps.currentScope}_${memberName}`;
      typeInfo = this.deps.typeRegistry.get(scopedName);
    } else if (ctx.isSimpleGlobalAccess) {
      // global.member pattern: lookup using direct name
      const memberName = ctx.identifiers[0];
      typeInfo = this.deps.typeRegistry.get(memberName);
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
    // Also applies to scoped atomic variables with clamp behavior
    if (
      typeInfo.overflowBehavior === "clamp" &&
      TypeCheckUtils.isInteger(typeInfo.baseType)
    ) {
      return AssignmentKind.OVERFLOW_CLAMP;
    }

    return null;
  }

  /**
   * Classify string assignments.
   */
  private classifyStringAssignment(
    ctx: IAssignmentContext,
  ): AssignmentKind | null {
    // Simple string variable
    if (ctx.isSimpleIdentifier) {
      const id = ctx.identifiers[0];
      const typeInfo = this.deps.typeRegistry.get(id);
      if (this.isSimpleStringType(typeInfo)) {
        return AssignmentKind.STRING_SIMPLE;
      }
    }

    // this.member string
    if (ctx.isSimpleThisAccess && this.deps.currentScope) {
      const memberName = ctx.identifiers[0];
      const scopedName = `${this.deps.currentScope}_${memberName}`;
      const typeInfo = this.deps.typeRegistry.get(scopedName);
      if (this.isSimpleStringType(typeInfo)) {
        return AssignmentKind.STRING_THIS_MEMBER;
      }
    }

    // global.member string
    if (ctx.isSimpleGlobalAccess) {
      const id = ctx.identifiers[0];
      const typeInfo = this.deps.typeRegistry.get(id);
      if (this.isSimpleStringType(typeInfo)) {
        return AssignmentKind.STRING_GLOBAL;
      }
    }

    // struct.field string (2 identifiers, no subscripts)
    const structFieldNames = this.getStructFieldNames(ctx);
    if (ctx.hasMemberAccess && !ctx.hasArrayAccess && structFieldNames) {
      const { structName, fieldName } = structFieldNames;
      const structTypeInfo = this.deps.typeRegistry.get(structName);

      if (structTypeInfo && this.deps.isKnownStruct(structTypeInfo.baseType)) {
        const structFields = this.deps.symbols.structFields.get(
          structTypeInfo.baseType,
        );
        const fieldType = structFields?.get(fieldName);
        if (fieldType && TypeCheckUtils.isString(fieldType)) {
          return AssignmentKind.STRING_STRUCT_FIELD;
        }
      }
    }

    // struct.arr[i] string array element (2 identifiers, 1 subscript)
    if (
      ctx.hasMemberAccess &&
      ctx.hasArrayAccess &&
      structFieldNames &&
      ctx.subscripts.length === 1
    ) {
      const { structName, fieldName } = structFieldNames;
      const structTypeInfo = this.deps.typeRegistry.get(structName);

      if (structTypeInfo && this.deps.isKnownStruct(structTypeInfo.baseType)) {
        const structType = structTypeInfo.baseType;
        const structFields = this.deps.symbols.structFields.get(structType);
        const fieldType = structFields?.get(fieldName);
        const fieldArrays = this.deps.symbols.structFieldArrays.get(structType);
        const dimensions = this.deps.symbols.structFieldDimensions
          .get(structType)
          ?.get(fieldName);

        if (
          fieldType &&
          TypeCheckUtils.isString(fieldType) &&
          fieldArrays?.has(fieldName) &&
          dimensions &&
          dimensions.length >= 1
        ) {
          return AssignmentKind.STRING_STRUCT_ARRAY_ELEMENT;
        }
      }
    }

    return null;
  }

  /**
   * Look up a bitmap field's width by bitmap type name and field name.
   * Returns the field width if found, or null if the bitmap/field doesn't exist.
   */
  private lookupBitmapFieldWidth(
    bitmapTypeName: string,
    fieldName: string,
  ): number | null {
    const fields = this.deps.symbols.bitmapFields.get(bitmapTypeName);
    if (fields?.has(fieldName)) {
      return fields.get(fieldName)!.width;
    }
    return null;
  }

  /**
   * Look up the bitmap type for a register member (e.g., "REG_MEMBER" -> "BitmapType").
   * Returns the bitmap type name if found, or null.
   */
  private lookupRegisterMemberBitmapType(
    registerName: string,
    memberName: string,
  ): string | null {
    const key = `${registerName}_${memberName}`;
    return this.deps.symbols.registerMemberTypes.get(key) ?? null;
  }
}

export default AssignmentClassifier;
