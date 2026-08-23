/**
 * StructCollector - Extracts struct type declarations from parse trees.
 * Handles fields with types, arrays, and const modifiers.
 *
 * Produces TType-based IStructSymbol with proper IScopeSymbol references.
 */

import * as Parser from "../../../parser/grammar/CNextParser";
import ESourceLanguage from "../../../../../utils/types/ESourceLanguage";
import IStructSymbol from "../../../../types/symbols/IStructSymbol";
import IFieldInfo from "../../../../types/symbols/IFieldInfo";
import IScopeSymbol from "../../../../types/symbols/IScopeSymbol";
import TypeResolver from "../../../../../utils/TypeResolver";
import TypeUtils from "../utils/TypeUtils";
import ArrayDimensionParser from "../../../../../utils/ArrayDimensionParser";
import TYPE_WIDTH from "../../../../constants/TYPE_WIDTH";

/**
 * Result of processing an arrayType syntax context.
 */
interface IArrayTypeResult {
  isArray: boolean;
  /**
   * Every dimension, or undefined if any one of them could not be resolved.
   *
   * All-or-nothing on purpose (issue #1158). A partial list silently shifts
   * later dimensions out of position -- `u8[N][3]` reporting [3] makes the
   * consumer treat 3 as dimension 1 -- and a truncated list is worse than no
   * list, because a non-empty list suppresses StructGenerator's AST fallback,
   * which resolves all dimensions correctly on its own.
   */
  dimensions: (number | string)[] | undefined;
}

/**
 * Process arrayType syntax (e.g., Item[3] items) and return array info.
 */
function processArrayTypeSyntax(
  arrayTypeCtx: Parser.ArrayTypeContext | null | undefined,
  constValues?: Map<string, number>,
): IArrayTypeResult {
  if (!arrayTypeCtx) {
    return { isArray: false, dimensions: undefined };
  }

  // Issue #1158: read every dimension. This previously took dims[0] only, so
  // `u8[2][3] cells` was recorded as [2]; that list is non-empty, so it won
  // over StructGenerator's AST fallback and both the .c and the .h emitted
  // `uint8_t cells[2]` while the body still emitted `cells[1][2]`.
  const dims = arrayTypeCtx.arrayTypeDimension();
  if (dims.length === 0) {
    return { isArray: true, dimensions: undefined };
  }

  const dimensions: (number | string)[] = [];
  for (const dim of dims) {
    const sizeExpr = dim.expression();
    if (!sizeExpr) {
      // Unsized `[]` -- size is not knowable here.
      return { isArray: true, dimensions: undefined };
    }
    const resolved = tryResolveExpressionDimension(sizeExpr, constValues);
    if (resolved === undefined) {
      // One unresolved dimension makes the whole list unusable; see the
      // all-or-nothing note on IArrayTypeResult.
      return { isArray: true, dimensions: undefined };
    }
    dimensions.push(resolved);
  }

  return { isArray: true, dimensions };
}

/**
 * Process string type fields and update dimensions array.
 */
function processStringField(
  stringCtx: Parser.StringTypeContext,
  arrayDims: Parser.ArrayDimensionContext[],
  dimensions: (number | string)[],
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
  // Issue #1157: defer to the shared evaluator rather than re-implementing a
  // weaker one here. This used to accept only a bare integer literal or a bare
  // const name, so `u8[8+1]` did not resolve; the dimension was dropped while
  // isArray stayed true, and the field reached the header as a scalar and the
  // body as a bit-indexed value while the .c declaration -- which folds through
  // its own path -- correctly said [9].
  // typeWidths comes from the same TYPE_WIDTH table codegen uses, so a
  // sizeof dimension folds identically here and in the .c. constValues is
  // the collection-time map rather than CodeGenState -- same evaluator and
  // same width table, different source for the consts, which is the only
  // part that legitimately differs between the two layers.
  return ArrayDimensionParser.parseSingleDimension(sizeExpr, {
    constValues,
    typeWidths: TYPE_WIDTH,
  });
}

/**
 * Parse array dimension expressions and append resolved sizes to dimensions array.
 */
function parseArrayDimensions(
  arrayDims: Parser.ArrayDimensionContext[],
  dimensions: (number | string)[],
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
   * @param scope The scope this struct belongs to (IScopeSymbol)
   * @param constValues Map of constant names to their numeric values (for resolving array dimensions)
   * @param isScopeType ADR-057 predicate: is this *qualified* name a scope type?
   * @returns The struct symbol with TType-based types and scope reference
   */
  static collect(
    ctx: Parser.StructDeclarationContext,
    sourceFile: string,
    scope: IScopeSymbol,
    constValues?: Map<string, number>,
    isScopeType?: (qualifiedName: string) => boolean,
  ): IStructSymbol {
    const name = ctx.IDENTIFIER().getText();
    const line = ctx.start?.line ?? 0;
    const scopeName = scope.name === "" ? undefined : scope.name;

    const fields = new Map<string, IFieldInfo>();

    for (const member of ctx.structMember()) {
      const fieldName = member.IDENTIFIER().getText();
      const fieldInfo = StructCollector.collectField(
        member,
        fieldName,
        scopeName,
        constValues,
        isScopeType,
      );
      fields.set(fieldName, fieldInfo);
    }

    return {
      kind: "struct",
      name,
      scope,
      sourceFile,
      sourceLine: line,
      sourceLanguage: ESourceLanguage.CNext,
      isExported: true,
      fields,
    };
  }

  /**
   * Collect a single struct field and return its IFieldInfo.
   * Now includes name and TType-based type.
   */
  private static collectField(
    member: Parser.StructMemberContext,
    fieldName: string,
    scopeName?: string,
    constValues?: Map<string, number>,
    isScopeType?: (qualifiedName: string) => boolean,
  ): IFieldInfo {
    const typeCtx = member.type();
    const fieldTypeStr = TypeUtils.getTypeName(typeCtx, scopeName, isScopeType);
    const fieldType = TypeResolver.resolve(fieldTypeStr);
    // Note: C-Next struct members don't have const modifier in grammar
    const isConst = false;
    // C-Next struct members don't have atomic modifier
    const isAtomic = false;

    const arrayDims = member.arrayDimension();
    const dimensions: (number | string)[] = [];
    let isArray = false;

    // Check for C-Next style arrayType syntax: Item[3] items -> typeCtx.arrayType()
    const arrayTypeResult = processArrayTypeSyntax(
      typeCtx.arrayType(),
      constValues,
    );
    if (arrayTypeResult.isArray) {
      isArray = true;
      if (arrayTypeResult.dimensions !== undefined) {
        dimensions.push(...arrayTypeResult.dimensions);
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

    return {
      name: fieldName,
      type: fieldType,
      isConst,
      isAtomic,
      isArray,
      dimensions: dimensions.length > 0 ? dimensions : undefined,
    };
  }
}

export default StructCollector;
