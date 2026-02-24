/**
 * Handler for simple assignments (ADR-109).
 *
 * The fallback case: generates `target = value;` or `target op= value;`
 * Used when no special handling is needed.
 *
 * Issue #845: MISRA 10.3 - For compound assignments on narrower types (i8, i16,
 * u8, u16), expands to explicit cast: `target = (type)(target OP value);`
 * Also handles int-to-float conversions with explicit casts.
 */
import IAssignmentContext from "../IAssignmentContext";
import CodeGenState from "../../../../state/CodeGenState";
import type ICodeGenApi from "../../types/ICodeGenApi";
import NarrowingCastHelper from "../../helpers/NarrowingCastHelper.js";
import TypeResolver from "../../TypeResolver.js";
import TYPE_MAP from "../../types/TYPE_MAP.js";
import CppModeHelper from "../../helpers/CppModeHelper.js";
import COMPOUND_TO_BINARY from "../../types/COMPOUND_TO_BINARY.js";

/** Get typed generator reference */
function gen(): ICodeGenApi {
  return CodeGenState.generator as ICodeGenApi;
}

/**
 * Try to handle compound assignment on narrow types (MISRA 10.3).
 * Returns the generated code if handled, null otherwise.
 */
function tryHandleCompoundNarrowingCast(
  ctx: IAssignmentContext,
  target: string,
): string | null {
  if (!ctx.isCompound || !ctx.firstIdTypeInfo) {
    return null;
  }

  const baseType = ctx.firstIdTypeInfo.baseType;
  const promotedType = NarrowingCastHelper.getPromotedType(baseType);

  if (promotedType !== "int" || baseType === "int") {
    return null;
  }

  const binaryOp = COMPOUND_TO_BINARY[ctx.cOp];
  if (!binaryOp) {
    return null;
  }

  const cType = TYPE_MAP[baseType] ?? baseType;
  const expr = `(${target} ${binaryOp} ${ctx.generatedValue})`;
  const castExpr = CppModeHelper.cast(cType, expr);
  return `${target} = ${castExpr};`;
}

/**
 * Try to handle cross-type-category conversion (int <-> float).
 * Returns the generated code if handled, null otherwise.
 */
function tryHandleIntToFloatConversion(
  ctx: IAssignmentContext,
  target: string,
): string | null {
  if (ctx.isCompound || !ctx.firstIdTypeInfo || !ctx.valueCtx) {
    return null;
  }

  const targetType = ctx.firstIdTypeInfo.baseType;
  const valueType = TypeResolver.getExpressionType(ctx.valueCtx);

  if (!valueType) {
    return null;
  }

  if (
    !NarrowingCastHelper.isCrossTypeCategoryConversion(valueType, targetType)
  ) {
    return null;
  }

  if (
    !NarrowingCastHelper.isIntegerType(valueType) ||
    !NarrowingCastHelper.isFloatType(targetType)
  ) {
    return null;
  }

  const castedValue = NarrowingCastHelper.wrapIntToFloat(
    ctx.generatedValue,
    targetType,
  );
  return `${target} ${ctx.cOp} ${castedValue};`;
}

/**
 * Handle simple variable assignment.
 *
 * @example
 * x <- 5           =>  x = 5;
 * counter +<- 1    =>  counter += 1;
 * i16_val &<- 0xFF =>  i16_val = (int16_t)(i16_val & 0xFF);  // MISRA 10.3
 */
function handleSimpleAssignment(ctx: IAssignmentContext): string {
  const target = gen().generateAssignmentTarget(ctx.targetCtx);

  // Try compound assignment narrowing cast (MISRA 10.3)
  const compoundResult = tryHandleCompoundNarrowingCast(ctx, target);
  if (compoundResult) {
    return compoundResult;
  }

  // Try int-to-float conversion
  const conversionResult = tryHandleIntToFloatConversion(ctx, target);
  if (conversionResult) {
    return conversionResult;
  }

  return `${target} ${ctx.cOp} ${ctx.generatedValue};`;
}

export default handleSimpleAssignment;
