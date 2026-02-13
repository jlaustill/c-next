/**
 * StructCollector - Extracts struct type declarations from parse trees.
 * Handles fields with types, arrays, and const modifiers.
 */

import * as Parser from "../../../parser/grammar/CNextParser";
import ESourceLanguage from "../../../../../utils/types/ESourceLanguage";
import IStructSymbol from "../../types/IStructSymbol";
import IFieldInfo from "../../types/IFieldInfo";
import TypeUtils from "../utils/TypeUtils";
import LiteralUtils from "../../../../../utils/LiteralUtils";

/**
 * Result of processing an arrayType syntax context.
 */
interface IArrayTypeResult {
  isArray: boolean;
  dimension: number | undefined;
}

/**
 * Process arrayType syntax (e.g., Item[3] items) and return array info.
 */
function processArrayTypeSyntax(
  arrayTypeCtx: Parser.ArrayTypeContext | null | undefined,
  constValues?: Map<string, number>,
): IArrayTypeResult {
  if (!arrayTypeCtx) {
    return { isArray: false, dimension: undefined };
  }

  // Get the first dimension (for backwards compatibility with single-dimension code)
  const dims = arrayTypeCtx.arrayTypeDimension();
  if (dims.length === 0) {
    return { isArray: true, dimension: undefined };
  }

  const sizeExpr = dims[0].expression();
  if (!sizeExpr) {
    return { isArray: true, dimension: undefined };
  }

  const resolved = tryResolveExpressionDimension(sizeExpr, constValues);
  return { isArray: true, dimension: resolved };
}

/**
 * Process string type fields and update dimensions array.
 */
function processStringField(
  stringCtx: Parser.StringTypeContext,
  arrayDims: Parser.ArrayDimensionContext[],
  dimensions: number[],
  constValues?: Map<string, number>,
): boolean {
  const intLiteral = stringCtx.INTEGER_LITERAL();
  if (!intLiteral) {
    return false;
  }

  const capacity = Number.parseInt(intLiteral.getText(), 10);

  // If there are array dimensions, they come BEFORE string capacity
  if (arrayDims.length > 0) {
    parseArrayDimensions(arrayDims, dimensions, constValues);
  }
  // String capacity becomes final dimension (+1 for null terminator)
  dimensions.push(capacity + 1);
  return true;
}

/**
 * Try to resolve a single expression as a numeric dimension.
 * Handles integer literals and const references.
 */
function tryResolveExpressionDimension(
  sizeExpr: Parser.ExpressionContext,
  constValues?: Map<string, number>,
): number | undefined {
  const dimText = sizeExpr.getText();
  const literalSize = LiteralUtils.parseIntegerLiteral(dimText);
  if (literalSize !== undefined) {
    return literalSize;
  }
  if (constValues?.has(dimText)) {
    return constValues.get(dimText);
  }
  return undefined;
}

/**
 * Parse array dimension expressions and append resolved sizes to dimensions array.
 */
function parseArrayDimensions(
  arrayDims: Parser.ArrayDimensionContext[],
  dimensions: number[],
  constValues?: Map<string, number>,
): void {
  for (const dim of arrayDims) {
    const sizeExpr = dim.expression();
    if (sizeExpr) {
      const resolved = tryResolveExpressionDimension(sizeExpr, constValues);
      if (resolved !== undefined) {
        dimensions.push(resolved);
      }
    }
  }
}

class StructCollector {
  /**
   * Collect a struct declaration and return an IStructSymbol.
   *
   * @param ctx The struct declaration context
   * @param sourceFile Source file path
   * @param scopeName Optional scope name for nested structs
   * @param constValues Map of constant names to their numeric values (for resolving array dimensions)
   * @returns The struct symbol
   */
  static collect(
    ctx: Parser.StructDeclarationContext,
    sourceFile: string,
    scopeName?: string,
    constValues?: Map<string, number>,
  ): IStructSymbol {
    const name = ctx.IDENTIFIER().getText();
    const fullName = scopeName ? `${scopeName}_${name}` : name;
    const line = ctx.start?.line ?? 0;

    const fields = new Map<string, IFieldInfo>();

    for (const member of ctx.structMember()) {
      const fieldInfo = StructCollector.collectField(
        member,
        scopeName,
        constValues,
      );
      fields.set(member.IDENTIFIER().getText(), fieldInfo);
    }

    return {
      name: fullName,
      parent: scopeName,
      sourceFile,
      sourceLine: line,
      sourceLanguage: ESourceLanguage.CNext,
      isExported: true,
      kind: "struct",
      fields,
    };
  }

  /**
   * Collect a single struct field and return its IFieldInfo.
   */
  private static collectField(
    member: Parser.StructMemberContext,
    scopeName?: string,
    constValues?: Map<string, number>,
  ): IFieldInfo {
    const typeCtx = member.type();
    const fieldType = TypeUtils.getTypeName(typeCtx, scopeName);
    // Note: C-Next struct members don't have const modifier in grammar
    const isConst = false;

    const arrayDims = member.arrayDimension();
    const dimensions: number[] = [];
    let isArray = false;

    // Check for C-Next style arrayType syntax: Item[3] items -> typeCtx.arrayType()
    const arrayTypeResult = processArrayTypeSyntax(
      typeCtx.arrayType(),
      constValues,
    );
    if (arrayTypeResult.isArray) {
      isArray = true;
      if (arrayTypeResult.dimension !== undefined) {
        dimensions.push(arrayTypeResult.dimension);
      }
      // Note: non-literal, non-const expressions (like global.EnumName.COUNT)
      // won't be resolvable at symbol collection time - dimensions stays empty
      // but isArray is still true so the field is tracked as an array
    }

    // Handle string types specially
    if (typeCtx.stringType()) {
      const stringHandled = processStringField(
        typeCtx.stringType()!,
        arrayDims,
        dimensions,
        constValues,
      );
      if (stringHandled) {
        isArray = true;
      }
    } else if (arrayDims.length > 0) {
      // Non-string array
      isArray = true;
      parseArrayDimensions(arrayDims, dimensions, constValues);
    }

    const fieldInfo: IFieldInfo = {
      type: fieldType,
      isArray,
      isConst,
    };

    if (dimensions.length > 0) {
      fieldInfo.dimensions = dimensions;
    }

    return fieldInfo;
  }
}

export default StructCollector;
