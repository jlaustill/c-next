/**
 * Assignment classifier for dispatch-based code generation (ADR-109).
 *
 * Analyzes an assignment context and determines which AssignmentKind it is.
 * The classification order matches the original generateAssignment() method's
 * if-else chain to ensure identical behavior.
 */
import AssignmentKind from "./AssignmentKind";
import IAssignmentContext from "./IAssignmentContext";
import ISymbolInfo from "../generators/ISymbolInfo";
import TTypeInfo from "../types/TTypeInfo";
import TypeCheckUtils from "../../utils/TypeCheckUtils";

/**
 * Dependencies for classification.
 */
interface IClassifierDeps {
  /** Symbol information (registers, bitmaps, structs, etc.) */
  readonly symbols: ISymbolInfo;

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
  constructor(private deps: IClassifierDeps) {}

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

    // Pattern: var.field (2 identifiers) - simple bitmap field
    if (ids.length === 2 && ctx.subscripts.length === 0) {
      const varName = ids[0];
      const fieldName = ids[1];
      const typeInfo = this.deps.typeRegistry.get(varName);

      if (typeInfo?.isBitmap && typeInfo.bitmapTypeName) {
        const fields = this.deps.symbols.bitmapFields.get(
          typeInfo.bitmapTypeName,
        );
        if (fields?.has(fieldName)) {
          const fieldInfo = fields.get(fieldName)!;
          return fieldInfo.width === 1
            ? AssignmentKind.BITMAP_FIELD_SINGLE_BIT
            : AssignmentKind.BITMAP_FIELD_MULTI_BIT;
        }
      }
    }

    // Pattern: REG.MEMBER.field or struct.bitmapMember.field (3 identifiers)
    if (ids.length === 3 && ctx.subscripts.length === 0) {
      const firstName = ids[0];
      const secondName = ids[1];
      const fieldName = ids[2];

      // Check if register member bitmap field: REG.MEMBER.field
      if (this.deps.symbols.knownRegisters.has(firstName)) {
        const fullRegMember = `${firstName}_${secondName}`;
        const bitmapType =
          this.deps.symbols.registerMemberTypes.get(fullRegMember);
        if (bitmapType) {
          const fields = this.deps.symbols.bitmapFields.get(bitmapType);
          if (fields?.has(fieldName)) {
            return AssignmentKind.REGISTER_MEMBER_BITMAP_FIELD;
          }
        }
      }

      // Check if struct member bitmap field: struct.bitmapMember.field
      if (!this.deps.symbols.knownRegisters.has(firstName)) {
        const structTypeInfo = this.deps.typeRegistry.get(firstName);
        if (
          structTypeInfo &&
          this.deps.isKnownStruct(structTypeInfo.baseType)
        ) {
          const memberInfo = this.deps.getMemberTypeInfo(
            structTypeInfo.baseType,
            secondName,
          );
          if (memberInfo) {
            const memberBitmapType = memberInfo.baseType;
            const fields = this.deps.symbols.bitmapFields.get(memberBitmapType);
            if (fields?.has(fieldName)) {
              return AssignmentKind.STRUCT_MEMBER_BITMAP_FIELD;
            }
          }
        }
      }
    }

    // Pattern: Scope.REG.MEMBER.field (4 identifiers)
    if (ids.length === 4 && ctx.subscripts.length === 0) {
      const scopeName = ids[0];
      if (this.deps.isKnownScope(scopeName)) {
        const fullRegName = `${scopeName}_${ids[1]}`;
        if (this.deps.symbols.knownRegisters.has(fullRegName)) {
          const fullRegMember = `${fullRegName}_${ids[2]}`;
          const bitmapType =
            this.deps.symbols.registerMemberTypes.get(fullRegMember);
          if (bitmapType) {
            const fields = this.deps.symbols.bitmapFields.get(bitmapType);
            if (fields?.has(ids[3])) {
              return AssignmentKind.SCOPED_REGISTER_MEMBER_BITMAP_FIELD;
            }
          }
        }
      }
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
    // (This covers the memberAccessCtx path in original code)
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
    if (ids.length === 1 && ctx.subscripts.length > 0) {
      if (typeInfo?.isArray && typeInfo.arrayDimensions) {
        const numDims = typeInfo.arrayDimensions.length;

        // Check for bit indexing on array element
        if (ctx.subscripts.length === numDims + 1) {
          if (TypeCheckUtils.isInteger(typeInfo.baseType)) {
            return AssignmentKind.ARRAY_ELEMENT_BIT;
          }
        }

        // Normal multi-dimensional array access
        return AssignmentKind.MULTI_DIM_ARRAY_ELEMENT;
      }
    }

    // Register bit access: REG.MEMBER[bit] or Scope.REG.MEMBER[bit]
    if (ids.length >= 2 && ctx.subscripts.length > 0) {
      // Check for scoped register
      if (this.deps.isKnownScope(firstId) && ids.length >= 3) {
        const scopedRegName = `${firstId}_${ids[1]}`;
        if (this.deps.symbols.knownRegisters.has(scopedRegName)) {
          return ctx.subscripts.length === 2
            ? AssignmentKind.REGISTER_BIT_RANGE
            : AssignmentKind.REGISTER_BIT;
        }
      }

      // Check for non-scoped register
      if (this.deps.symbols.knownRegisters.has(firstId)) {
        return ctx.subscripts.length === 2
          ? AssignmentKind.REGISTER_BIT_RANGE
          : AssignmentKind.REGISTER_BIT;
      }

      // Bitmap array element field: bitmapArr[i].field
      if (ids.length === 2 && ctx.subscripts.length === 1) {
        if (typeInfo?.isBitmap && typeInfo?.isArray) {
          const bitmapType = typeInfo.bitmapTypeName;
          if (bitmapType) {
            const fields = this.deps.symbols.bitmapFields.get(bitmapType);
            if (fields?.has(ids[1])) {
              return AssignmentKind.BITMAP_ARRAY_ELEMENT_FIELD;
            }
          }
        }
      }
    }

    // Let other classifiers (e.g., classifyString) try to handle this pattern
    // MEMBER_CHAIN will be the fallback in classify() method
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

    // === Global prefix ===
    if (ctx.hasGlobal && ctx.postfixOpsCount > 0) {
      const firstId = ctx.identifiers[0];

      if (ctx.hasArrayAccess) {
        // global.reg[bit] or global.arr[i]
        if (this.deps.symbols.knownRegisters.has(firstId)) {
          return AssignmentKind.GLOBAL_REGISTER_BIT;
        }
        return AssignmentKind.GLOBAL_ARRAY;
      }

      // global.member (no subscripts)
      return AssignmentKind.GLOBAL_MEMBER;
    }

    // === This prefix ===
    if (ctx.hasThis && ctx.postfixOpsCount > 0) {
      if (!this.deps.currentScope) {
        // Will throw in handler, but classify for dispatch
        return AssignmentKind.THIS_MEMBER;
      }

      const firstId = ctx.identifiers[0];
      const scopedRegName = `${this.deps.currentScope}_${firstId}`;

      if (ctx.hasArrayAccess) {
        // this.reg[bit] or this.REG.MEMBER[bit] (scoped register bit access)
        if (this.deps.symbols.knownRegisters.has(scopedRegName)) {
          // Check for bit range vs single bit
          const hasBitRange = ctx.postfixOps.some((op) => op.COMMA() !== null);
          if (hasBitRange) {
            return AssignmentKind.SCOPED_REGISTER_BIT_RANGE;
          }
          return AssignmentKind.SCOPED_REGISTER_BIT;
        }
        return AssignmentKind.THIS_ARRAY;
      }

      // this.REG.MEMBER.field (scoped register bitmap field)
      if (
        ctx.identifiers.length === 3 &&
        this.deps.symbols.knownRegisters.has(scopedRegName)
      ) {
        const fullRegMember = `${scopedRegName}_${ctx.identifiers[1]}`;
        const bitmapType =
          this.deps.symbols.registerMemberTypes.get(fullRegMember);
        if (bitmapType) {
          // Handled as scoped register bitmap field
          return AssignmentKind.SCOPED_REGISTER_MEMBER_BITMAP_FIELD;
        }
      }

      // this.member
      return AssignmentKind.THIS_MEMBER;
    }

    return null;
  }

  /**
   * Classify simple array/bit access (no prefix, no member access).
   * Pattern: arr[i] or flags[bit]
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
    const typeInfo = this.deps.typeRegistry.get(name);

    // Check for actual array or string type
    // Note: isArray is true for both sized arrays (u8 arr[10]) and unsized parameters (u8 arr[])
    // Unsized arrays may have empty arrayDimensions, so check isArray flag first
    const isActualArray = typeInfo?.isArray || typeInfo?.isString;

    if (isActualArray) {
      // Slice assignment: arr[offset, length]
      if (ctx.subscripts.length === 2) {
        return AssignmentKind.ARRAY_SLICE;
      }

      // String array element
      if (
        typeInfo?.isString &&
        typeInfo.arrayDimensions &&
        typeInfo.arrayDimensions.length > 1
      ) {
        return AssignmentKind.STRING_ARRAY_ELEMENT;
      }

      // Normal array element
      return AssignmentKind.ARRAY_ELEMENT;
    }

    // Bit manipulation on scalar integer
    if (ctx.subscripts.length === 1) {
      return AssignmentKind.INTEGER_BIT;
    } else if (ctx.subscripts.length === 2) {
      return AssignmentKind.INTEGER_BIT_RANGE;
    }

    return null;
  }

  /**
   * Classify atomic and overflow-clamped compound assignments.
   */
  private classifySpecialCompound(
    ctx: IAssignmentContext,
  ): AssignmentKind | null {
    if (!ctx.isCompound || !ctx.isSimpleIdentifier) {
      return null;
    }

    const id = ctx.identifiers[0];
    const typeInfo = this.deps.typeRegistry.get(id);

    if (!typeInfo) {
      return null;
    }

    // Atomic RMW
    if (typeInfo.isAtomic) {
      return AssignmentKind.ATOMIC_RMW;
    }

    // Overflow clamp (integers only, not floats)
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
      if (
        typeInfo?.isString &&
        typeInfo.stringCapacity !== undefined &&
        (!typeInfo.arrayDimensions || typeInfo.arrayDimensions.length <= 1)
      ) {
        return AssignmentKind.STRING_SIMPLE;
      }
    }

    // this.member string
    if (ctx.isSimpleThisAccess && this.deps.currentScope) {
      const memberName = ctx.identifiers[0];
      const scopedName = `${this.deps.currentScope}_${memberName}`;
      const typeInfo = this.deps.typeRegistry.get(scopedName);
      if (
        typeInfo?.isString &&
        typeInfo.stringCapacity !== undefined &&
        (!typeInfo.arrayDimensions || typeInfo.arrayDimensions.length <= 1)
      ) {
        return AssignmentKind.STRING_THIS_MEMBER;
      }
    }

    // global.member string
    if (ctx.isSimpleGlobalAccess) {
      const id = ctx.identifiers[0];
      const typeInfo = this.deps.typeRegistry.get(id);
      if (
        typeInfo?.isString &&
        typeInfo.stringCapacity !== undefined &&
        (!typeInfo.arrayDimensions || typeInfo.arrayDimensions.length <= 1)
      ) {
        return AssignmentKind.STRING_GLOBAL;
      }
    }

    // struct.field string (2 identifiers, no subscripts)
    if (
      ctx.hasMemberAccess &&
      !ctx.hasArrayAccess &&
      ctx.identifiers.length === 2
    ) {
      const structName = ctx.identifiers[0];
      const fieldName = ctx.identifiers[1];
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
      ctx.identifiers.length === 2 &&
      ctx.subscripts.length === 1
    ) {
      const structName = ctx.identifiers[0];
      const fieldName = ctx.identifiers[1];
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
}

export default AssignmentClassifier;
