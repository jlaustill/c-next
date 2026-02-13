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
import BitUtils from "../../../../../utils/BitUtils";
import TAssignmentHandler from "./TAssignmentHandler";
import CodeGenState from "../../../../state/CodeGenState";
import TypeValidator from "../../TypeValidator";
import type ICodeGenApi from "../../types/ICodeGenApi";
import QualifiedNameGenerator from "../../utils/QualifiedNameGenerator";

/** Get typed generator reference */
function gen(): ICodeGenApi {
  return CodeGenState.generator as ICodeGenApi;
}

/**
 * Calculate mask value and hex string for bitmap field.
 */
function calculateMask(width: number): { mask: number; maskHex: string } {
  const mask = (1 << width) - 1;
  const maskHex = BitUtils.formatHex(mask);
  return { mask, maskHex };
}

/**
 * Validate and get bitmap field info, throwing appropriate errors.
 */
function getBitmapFieldInfo(
  bitmapType: string,
  fieldName: string,
  ctx: IAssignmentContext,
): { offset: number; width: number } {
  const fields = CodeGenState.symbols!.bitmapFields.get(bitmapType);
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
    TypeValidator.validateBitmapFieldLiteral(
      ctx.valueCtx,
      fieldInfo.width,
      fieldName,
    );
  }

  return fieldInfo;
}

/**
 * Generate bitmap field write using read-modify-write pattern.
 */
function generateBitmapWrite(
  target: string,
  fieldInfo: { offset: number; width: number },
  value: string,
): string {
  const { maskHex } = calculateMask(fieldInfo.width);

  if (fieldInfo.width === 1) {
    // Single bit write: target = (target & ~(1 << offset)) | ((value ? 1 : 0) << offset)
    return `${target} = (${target} & ~(1 << ${fieldInfo.offset})) | (${BitUtils.boolToInt(value)} << ${fieldInfo.offset});`;
  } else {
    // Multi-bit write: target = (target & ~(mask << offset)) | ((value & mask) << offset)
    return `${target} = (${target} & ~(${maskHex} << ${fieldInfo.offset})) | ((${value} & ${maskHex}) << ${fieldInfo.offset});`;
  }
}

/**
 * Generate write-only bitmap field write (no RMW).
 */
function generateWriteOnlyBitmapWrite(
  target: string,
  fieldInfo: { offset: number; width: number },
  value: string,
): string {
  const { maskHex } = calculateMask(fieldInfo.width);

  if (fieldInfo.width === 1) {
    return `${target} = (${BitUtils.boolToInt(value)} << ${fieldInfo.offset});`;
  } else {
    return `${target} = ((${value} & ${maskHex}) << ${fieldInfo.offset});`;
  }
}

/**
 * Handle simple bitmap field: flags.Running <- true
 */
function handleBitmapFieldSingleBit(ctx: IAssignmentContext): string {
  const varName = ctx.identifiers[0];
  const fieldName = ctx.identifiers[1];
  const typeInfo = CodeGenState.getVariableTypeInfo(varName);
  const bitmapType = typeInfo!.bitmapTypeName!;

  const fieldInfo = getBitmapFieldInfo(bitmapType, fieldName, ctx);
  return generateBitmapWrite(varName, fieldInfo, ctx.generatedValue);
}

/**
 * Handle multi-bit bitmap field: flags.Mode <- 3
 */
function handleBitmapFieldMultiBit(ctx: IAssignmentContext): string {
  // Same logic as single bit, generateBitmapWrite handles width
  return handleBitmapFieldSingleBit(ctx);
}

/**
 * Handle bitmap array element field: bitmapArr[i].Field <- value
 */
function handleBitmapArrayElementField(ctx: IAssignmentContext): string {
  const arrayName = ctx.identifiers[0];
  const fieldName = ctx.identifiers[1];
  const typeInfo = CodeGenState.getVariableTypeInfo(arrayName);
  const bitmapType = typeInfo!.bitmapTypeName!;

  const fieldInfo = getBitmapFieldInfo(bitmapType, fieldName, ctx);
  const index = gen().generateExpression(ctx.subscripts[0]);
  const arrayElement = `${arrayName}[${index}]`;

  return generateBitmapWrite(arrayElement, fieldInfo, ctx.generatedValue);
}

/**
 * Handle struct member bitmap field: device.flags.Active <- true
 */
function handleStructMemberBitmapField(ctx: IAssignmentContext): string {
  const structName = ctx.identifiers[0];
  const memberName = ctx.identifiers[1];
  const fieldName = ctx.identifiers[2];

  const structTypeInfo = CodeGenState.getVariableTypeInfo(structName);
  const memberInfo = CodeGenState.getMemberTypeInfo(
    structTypeInfo!.baseType,
    memberName,
  );
  const bitmapType = memberInfo!.baseType;

  const fieldInfo = getBitmapFieldInfo(bitmapType, fieldName, ctx);
  const memberPath = `${structName}.${memberName}`;

  return generateBitmapWrite(memberPath, fieldInfo, ctx.generatedValue);
}

/**
 * Handle register member bitmap field: MOTOR.CTRL.Running <- true
 */
function handleRegisterMemberBitmapField(ctx: IAssignmentContext): string {
  const regName = ctx.identifiers[0];
  const memberName = ctx.identifiers[1];
  const fieldName = ctx.identifiers[2];

  const fullRegMember = `${regName}_${memberName}`;
  const bitmapType =
    CodeGenState.symbols!.registerMemberTypes.get(fullRegMember)!;

  const fieldInfo = getBitmapFieldInfo(bitmapType, fieldName, ctx);
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
): string {
  let scopeName: string;
  let regName: string;
  let memberName: string;
  let fieldName: string;

  if (ctx.hasThis) {
    // this.REG.MEMBER.field - 3 identifiers
    if (!CodeGenState.currentScope) {
      throw new Error("Error: 'this' can only be used inside a scope");
    }
    scopeName = CodeGenState.currentScope;
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
    gen().validateCrossScopeVisibility(scopeName, regName);
  }

  const fullRegName = QualifiedNameGenerator.forMember(scopeName, regName);
  const fullRegMember = QualifiedNameGenerator.forMember(
    fullRegName,
    memberName,
  );
  const bitmapType =
    CodeGenState.symbols!.registerMemberTypes.get(fullRegMember)!;

  const fieldInfo = getBitmapFieldInfo(bitmapType, fieldName, ctx);

  // Check for write-only register (includes w1s, w1c)
  const accessMod =
    CodeGenState.symbols!.registerMemberAccess.get(fullRegMember);
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
