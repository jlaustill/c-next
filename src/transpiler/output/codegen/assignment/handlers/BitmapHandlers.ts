/**
 * Bitmap field assignment handlers (ADR-109).
 *
 * Handles assignments to bitmap fields:
 * - BITMAP_FIELD_SINGLE_BIT: flags.Running <- true
 * - BITMAP_FIELD_MULTI_BIT: flags.Mode <- 3
 * - BITMAP_ARRAY_ELEMENT_FIELD: bitmapArr[i].Field <- value
 * - STRUCT_MEMBER_BITMAP_FIELD: device.flags.Active <- true
 * - REGISTER_MEMBER_BITMAP_FIELD: MOTOR.CTRL.Running <- true
 * - SCOPED_REGISTER_MEMBER_BITMAP_FIELD: Scope.GPIO7.ICR1.LED <- value
 */
import AssignmentKind from "../AssignmentKind";
import IAssignmentContext from "../IAssignmentContext";
import IHandlerDeps from "./IHandlerDeps";
import BitUtils from "../../../../../utils/BitUtils";
import TAssignmentHandler from "./TAssignmentHandler";

/**
 * Validate and get bitmap field info, throwing appropriate errors.
 */
function getBitmapFieldInfo(
  bitmapType: string,
  fieldName: string,
  ctx: IAssignmentContext,
  deps: IHandlerDeps,
): { offset: number; width: number } {
  const fields = deps.symbols.bitmapFields.get(bitmapType);
  if (!fields?.has(fieldName)) {
    throw new Error(
      `Error: Unknown bitmap field '${fieldName}' on type '${bitmapType}'`,
    );
  }

  const fieldInfo = fields.get(fieldName)!;

  // Validate compound operators not allowed
  if (ctx.isCompound) {
    throw new Error(
      `Compound assignment operators not supported for bitmap field access: ${ctx.cnextOp}`,
    );
  }

  // Validate compile-time literal overflow
  if (ctx.valueCtx) {
    deps.validateBitmapFieldLiteral(ctx.valueCtx, fieldInfo.width, fieldName);
  }

  return fieldInfo;
}

/**
 * Get the mask hex string for a given bit width.
 */
function getMaskHex(width: number): string {
  const mask = (1 << width) - 1;
  return BitUtils.formatHex(mask);
}

/**
 * Generate bitmap field write using read-modify-write pattern.
 */
function generateBitmapWrite(
  target: string,
  fieldInfo: { offset: number; width: number },
  value: string,
): string {
  if (fieldInfo.width === 1) {
    // Single bit write: target = (target & ~(1 << offset)) | ((value ? 1 : 0) << offset)
    return `${target} = (${target} & ~(1 << ${fieldInfo.offset})) | (${BitUtils.boolToInt(value)} << ${fieldInfo.offset});`;
  }

  // Multi-bit write: target = (target & ~(mask << offset)) | ((value & mask) << offset)
  const maskHex = getMaskHex(fieldInfo.width);
  return `${target} = (${target} & ~(${maskHex} << ${fieldInfo.offset})) | ((${value} & ${maskHex}) << ${fieldInfo.offset});`;
}

/**
 * Generate write-only bitmap field write (no RMW).
 */
function generateWriteOnlyBitmapWrite(
  target: string,
  fieldInfo: { offset: number; width: number },
  value: string,
): string {
  if (fieldInfo.width === 1) {
    return `${target} = (${BitUtils.boolToInt(value)} << ${fieldInfo.offset});`;
  }

  const maskHex = getMaskHex(fieldInfo.width);
  return `${target} = ((${value} & ${maskHex}) << ${fieldInfo.offset});`;
}

/**
 * Handle simple bitmap field: flags.Running <- true
 */
function handleBitmapFieldSingleBit(
  ctx: IAssignmentContext,
  deps: IHandlerDeps,
): string {
  const varName = ctx.identifiers[0];
  const fieldName = ctx.identifiers[1];
  const typeInfo = deps.typeRegistry.get(varName);
  const bitmapType = typeInfo!.bitmapTypeName!;

  const fieldInfo = getBitmapFieldInfo(bitmapType, fieldName, ctx, deps);
  return generateBitmapWrite(varName, fieldInfo, ctx.generatedValue);
}

/**
 * Handle multi-bit bitmap field: flags.Mode <- 3
 */
function handleBitmapFieldMultiBit(
  ctx: IAssignmentContext,
  deps: IHandlerDeps,
): string {
  // Same logic as single bit, generateBitmapWrite handles width
  return handleBitmapFieldSingleBit(ctx, deps);
}

/**
 * Handle bitmap array element field: bitmapArr[i].Field <- value
 */
function handleBitmapArrayElementField(
  ctx: IAssignmentContext,
  deps: IHandlerDeps,
): string {
  const arrayName = ctx.identifiers[0];
  const fieldName = ctx.identifiers[1];
  const typeInfo = deps.typeRegistry.get(arrayName);
  const bitmapType = typeInfo!.bitmapTypeName!;

  const fieldInfo = getBitmapFieldInfo(bitmapType, fieldName, ctx, deps);
  const index = deps.generateExpression(ctx.subscripts[0]);
  const arrayElement = `${arrayName}[${index}]`;

  return generateBitmapWrite(arrayElement, fieldInfo, ctx.generatedValue);
}

/**
 * Handle struct member bitmap field: device.flags.Active <- true
 */
function handleStructMemberBitmapField(
  ctx: IAssignmentContext,
  deps: IHandlerDeps,
): string {
  const structName = ctx.identifiers[0];
  const memberName = ctx.identifiers[1];
  const fieldName = ctx.identifiers[2];

  const structTypeInfo = deps.typeRegistry.get(structName);
  const memberInfo = deps.getMemberTypeInfo(
    structTypeInfo!.baseType,
    memberName,
  );
  const bitmapType = memberInfo!.baseType;

  const fieldInfo = getBitmapFieldInfo(bitmapType, fieldName, ctx, deps);
  const memberPath = `${structName}.${memberName}`;

  return generateBitmapWrite(memberPath, fieldInfo, ctx.generatedValue);
}

/**
 * Handle register member bitmap field: MOTOR.CTRL.Running <- true
 */
function handleRegisterMemberBitmapField(
  ctx: IAssignmentContext,
  deps: IHandlerDeps,
): string {
  const regName = ctx.identifiers[0];
  const memberName = ctx.identifiers[1];
  const fieldName = ctx.identifiers[2];

  const fullRegMember = `${regName}_${memberName}`;
  const bitmapType = deps.symbols.registerMemberTypes.get(fullRegMember)!;

  const fieldInfo = getBitmapFieldInfo(bitmapType, fieldName, ctx, deps);
  return generateBitmapWrite(fullRegMember, fieldInfo, ctx.generatedValue);
}

/**
 * Handle scoped register member bitmap field.
 * Two patterns:
 * - this.REG.MEMBER.field (hasThis=true, 3 identifiers) - scope from currentScope
 * - Scope.REG.MEMBER.field (hasThis=false, 4 identifiers) - scope from identifiers[0]
 */
function handleScopedRegisterMemberBitmapField(
  ctx: IAssignmentContext,
  deps: IHandlerDeps,
): string {
  let scopeName: string;
  let regName: string;
  let memberName: string;
  let fieldName: string;

  if (ctx.hasThis) {
    // this.REG.MEMBER.field - 3 identifiers
    if (!deps.currentScope) {
      throw new Error("Error: 'this' can only be used inside a scope");
    }
    scopeName = deps.currentScope;
    regName = ctx.identifiers[0];
    memberName = ctx.identifiers[1];
    fieldName = ctx.identifiers[2];
  } else {
    // Scope.REG.MEMBER.field - 4 identifiers
    scopeName = ctx.identifiers[0];
    regName = ctx.identifiers[1];
    memberName = ctx.identifiers[2];
    fieldName = ctx.identifiers[3];

    // Validate cross-scope access
    deps.validateCrossScopeVisibility(scopeName, regName);
  }

  const fullRegName = `${scopeName}_${regName}`;
  const fullRegMember = `${fullRegName}_${memberName}`;
  const bitmapType = deps.symbols.registerMemberTypes.get(fullRegMember)!;

  const fieldInfo = getBitmapFieldInfo(bitmapType, fieldName, ctx, deps);

  // Check for write-only register (includes w1s, w1c)
  const accessMod = deps.symbols.registerMemberAccess.get(fullRegMember);
  const isWriteOnly =
    accessMod === "wo" || accessMod === "w1s" || accessMod === "w1c";

  if (isWriteOnly) {
    return generateWriteOnlyBitmapWrite(
      fullRegMember,
      fieldInfo,
      ctx.generatedValue,
    );
  }

  return generateBitmapWrite(fullRegMember, fieldInfo, ctx.generatedValue);
}

/**
 * All bitmap handlers for registration.
 */
const bitmapHandlers: ReadonlyArray<[AssignmentKind, TAssignmentHandler]> = [
  [AssignmentKind.BITMAP_FIELD_SINGLE_BIT, handleBitmapFieldSingleBit],
  [AssignmentKind.BITMAP_FIELD_MULTI_BIT, handleBitmapFieldMultiBit],
  [AssignmentKind.BITMAP_ARRAY_ELEMENT_FIELD, handleBitmapArrayElementField],
  [AssignmentKind.STRUCT_MEMBER_BITMAP_FIELD, handleStructMemberBitmapField],
  [
    AssignmentKind.REGISTER_MEMBER_BITMAP_FIELD,
    handleRegisterMemberBitmapField,
  ],
  [
    AssignmentKind.SCOPED_REGISTER_MEMBER_BITMAP_FIELD,
    handleScopedRegisterMemberBitmapField,
  ],
];

export default bitmapHandlers;
