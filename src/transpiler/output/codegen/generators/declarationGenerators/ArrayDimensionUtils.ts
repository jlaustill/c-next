/**
 * ArrayDimensionUtils - Shared utilities for generating array dimension strings.
 *
 * Used by StructGenerator and ScopeGenerator for consistent array dimension handling.
 */

import * as Parser from "../../../../logic/parser/grammar/CNextParser";
import IOrchestrator from "../IOrchestrator";

/**
 * Generate array type dimension string from arrayType syntax (e.g., u8[16]).
 * Evaluates constants when possible, falls back to expression generation.
 *
 * @param arrayTypeCtx - The arrayType context, or null if not present
 * @param orchestrator - The orchestrator for constant evaluation and expression generation
 * @returns Dimension string like "[16]", "[]", or "" if no arrayType
 */
function generateArrayTypeDimension(
  arrayTypeCtx: Parser.ArrayTypeContext | null,
  orchestrator: IOrchestrator,
): string {
  if (arrayTypeCtx === null) {
    return "";
  }

  // Handle all dimensions from arrayType (supports u8[4][4], u8[], etc.)
  const dims = arrayTypeCtx.arrayTypeDimension();
  let result = "";
  for (const dim of dims) {
    const sizeExpr = dim.expression();
    if (!sizeExpr) {
      result += "[]";
      continue;
    }

    const constValue = orchestrator.tryEvaluateConstant(sizeExpr);
    if (constValue === undefined) {
      // Fall back to expression generation for macros, enums, etc.
      result += `[${orchestrator.generateExpression(sizeExpr)}]`;
    } else {
      result += `[${constValue}]`;
    }
  }

  return result;
}

/**
 * Generate string capacity dimension if applicable.
 * Adds +1 for null terminator.
 *
 * @param typeCtx - The type context to check for string type
 * @returns Dimension string like "[33]" for string<32>, or "" if not a string
 */
function generateStringCapacityDim(typeCtx: Parser.TypeContext): string {
  const stringCtx = typeCtx.stringType();
  if (!stringCtx) {
    return "";
  }

  const intLiteral = stringCtx.INTEGER_LITERAL();
  if (!intLiteral) {
    return "";
  }

  const capacity = Number.parseInt(intLiteral.getText(), 10);
  return `[${capacity + 1}]`;
}

class ArrayDimensionUtils {
  static readonly generateArrayTypeDimension = generateArrayTypeDimension;
  static readonly generateStringCapacityDim = generateStringCapacityDim;
}

export default ArrayDimensionUtils;
