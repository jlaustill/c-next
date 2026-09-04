/**
 * StructCollector - Extracts struct type declarations from parse trees.
 * Handles fields with types, arrays, and const modifiers.
 *
 * Produces TType-based IStructSymbol with proper IScopeSymbol references.
 */

import * as Parser from "../../../parser/grammar/CNextParser";
import ESourceLanguage from "../../../../../utils/types/ESourceLanguage";
import IStructSymbol from "../../../../types/symbols/IStructSymbol";
import type IStructFieldSymbol from "../../../../types/symbols/IStructFieldSymbol";
import TypeResolver from "../../../../../utils/TypeResolver";
import TypeUtils from "../utils/TypeUtils";
import DimensionResolver from "../utils/DimensionResolver";
import ScopeUtils from "../../../../../utils/ScopeUtils";
import TVisibility from "../../../../types/TVisibility";
import ParserUtils from "../../../../../utils/ParserUtils";
import MemberSymbolBase from "../utils/MemberSymbolBase";
import type ISourceSpan from "../../../../types/ISourceSpan";

/**
 * Result of processing an arrayType syntax context.
 */
interface IArrayTypeResult {
  isArray: boolean;
  /**
   * Every dimension, or undefined when the count is not knowable here -- no
   * dimensions at all, or an unsized `[]`.
   *
   * A dimension that does not fold is NOT dropped: DimensionResolver carries
   * it as source text, and qualifyStructFieldDimensions resolves it later. So
   * `u8[EColor.COUNT][3]` yields ["EColor.COUNT", 3], not undefined.
   *
   * That resolution covers enum-qualified names. Text naming anything else C
   * does not know reaches the header verbatim and does not compile -- #1175.
   *
   * Position matters more than resolution (issue #1158). A partial list
   * silently shifts later dimensions -- `u8[N][3]` reporting [3] makes the
   * consumer treat 3 as dimension 1 -- and a truncated list is worse than no
   * list, because a non-empty list suppresses StructGenerator's AST fallback,
   * which resolves all dimensions correctly on its own. Either every slot is
   * present, or the list is undefined.
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
    // Always a number or the source text -- never undefined -- so every slot
    // is filled and positions are preserved.
    dimensions.push(tryResolveExpressionDimension(sizeExpr, constValues));
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
): number | string {
  return DimensionResolver.resolve(sizeExpr, constValues);
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
      dimensions.push(tryResolveExpressionDimension(sizeExpr, constValues));
    }
  }
}

/**
 * The declaring struct's facts, as one parameter.
 *
 * #1318 added three arguments to `collectField` -- the owner's scoped name,
 * the source file and the inherited visibility -- taking it to 8 against a
 * limit of 7. They are not three independent knobs: they are one answer to
 * "which struct is this field part of", so they travel together.
 */
interface IFieldOwner {
  readonly scopedName: string;
  readonly sourceFile: string;
  readonly visibility: TVisibility;

  /** The struct's own span, inherited by a field that has no start token. */
  readonly span: ISourceSpan;
}

class StructCollector {
  /**
   * Collect a struct declaration and return an IStructSymbol.
   *
   * @param ctx The struct declaration context
   * @param sourceFile Source file path
   * @param scopePath The path of the scope this struct belongs to (dotted path, "" at file scope)
   * @param constValues Map of constant names to their numeric values (for resolving array dimensions)
   * @param isScopeType ADR-057 predicate: is this *qualified* name a scope type?
   * @returns The struct symbol with TType-based types and scope reference
   */
  static collect(
    ctx: Parser.StructDeclarationContext,
    sourceFile: string,
    scopePath: string,
    visibility: TVisibility,
    constValues?: Map<string, number>,
    isScopeType?: (qualifiedName: string) => boolean,
  ): IStructSymbol {
    const name = ctx.IDENTIFIER().getText();
    const span = ParserUtils.getSpan(ctx);
    // #1298: members carry the scope's PATH, not the scope object. The path
    // holds every outer component, so nothing downstream can flatten it to a
    // leaf -- which is what the reference threaded here used to protect against.

    const fields = new Map<string, IStructFieldSymbol>();
    // #1318: a field hangs off the STRUCT, not the enclosing scope.
    const identity = ScopeUtils.identityOf({ name, scopePath });
    const ownerScopedName = identity.cnxScopedName;

    for (const member of ctx.structMember()) {
      const fieldName = member.IDENTIFIER().getText();
      const fieldInfo = StructCollector.collectField(
        member,
        fieldName,
        { scopedName: ownerScopedName, sourceFile, visibility, span },
        scopePath,
        constValues,
        isScopeType,
      );
      fields.set(fieldName, fieldInfo);
    }

    return {
      kind: "struct",
      name,
      scopePath,
      // #1285: identity computed once, from the scope chain, not
      // re-derived by every consumer.
      // #1318 review: the same identity the members were keyed by, not a
      // second call with the same arguments -- change one and the members
      // would keep the old parent name while this reported the new one.
      ...identity,
      sourceFile,
      span,
      sourceLanguage: ESourceLanguage.CNext,
      visibility,
      fields,
    };
  }

  /**
   * Collect a single struct field and return its symbol.
   *
   * #1318: a field is a symbol, so it carries its OWN span -- a struct
   * declared across twenty lines used to give every field the struct's
   * position, or none at all.
   */
  private static collectField(
    member: Parser.StructMemberContext,
    fieldName: string,
    owner: IFieldOwner,
    scopePath = "",
    constValues?: Map<string, number>,
    isScopeType?: (qualifiedName: string) => boolean,
  ): IStructFieldSymbol {
    const typeCtx = member.type();
    const fieldTypeStr = TypeUtils.getTypeName(typeCtx, scopePath, isScopeType);
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
      // dimensions is undefined only for an unsized `[]` or no dimensions at
      // all; an expression that does not fold (global.EnumName.COUNT) is
      // carried as source text and resolved by qualifyStructFieldDimensions.
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
      ...MemberSymbolBase.of({
        kind: "struct_field" as const,
        name: fieldName,
        parentScopedName: owner.scopedName,
        memberCtx: member,
        parentSpan: owner.span,
        sourceFile: owner.sourceFile,
        visibility: owner.visibility,
      }),
      type: fieldType,
      isConst,
      isAtomic,
      isArray,
      dimensions: dimensions.length > 0 ? dimensions : undefined,
    };
  }
}

export default StructCollector;
