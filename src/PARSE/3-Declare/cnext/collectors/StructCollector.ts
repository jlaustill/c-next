/**
 * StructCollector - Extracts struct type declarations from parse trees.
 * Handles fields with types, arrays, and const modifiers.
 *
 * Produces TType-based IStructSymbol with proper IScopeSymbol references.
 */

import * as Parser from "../../../2-Parse/grammar/CNextParser";
import ESourceLanguage from "../../../../utils/types/ESourceLanguage";
import IStructSymbol from "../../../../types/symbols/IStructSymbol";
import type IStructFieldSymbol from "../../../../types/symbols/IStructFieldSymbol";
import TypeUtils from "../utils/TypeUtils";
import DimensionResolver from "../utils/DimensionResolver";
import type IDeclaredDimension from "../types/IDeclaredDimension";
import ScopeUtils from "../../../../utils/ScopeUtils";
import TVisibility from "../../../../types/TVisibility";
import ParserUtils from "../../../../utils/ParserUtils";
import MemberSymbolBase from "../utils/MemberSymbolBase";
import OverflowBehaviorUtils from "../../../../utils/OverflowBehaviorUtils";
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
   * A dimension that does not fold here is NOT dropped: DimensionResolver
   * keeps it as written, and 1.4 Resolve settles it. So `u8[EColor.COUNT][3]`
   * yields two slots, not undefined. (#1175: it used to keep the source TEXT,
   * which reached the header naming what C cannot see.)
   *
   * Position matters more than resolution (issue #1158). A partial list
   * silently shifts later dimensions -- `u8[N][3]` reporting [3] makes the
   * consumer treat 3 as dimension 1 -- and a truncated list is worse than no
   * list, because a non-empty list suppresses StructGenerator's AST fallback,
   * which resolves all dimensions correctly on its own. Either every slot is
   * present, or the list is undefined.
   */
  dimensions: IDeclaredDimension[] | undefined;
}

/**
 * Process arrayType syntax (e.g., Item[3] items) and return array info.
 */
function processArrayTypeSyntax(
  arrayTypeCtx: Parser.ArrayTypeContext | null | undefined,
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

  const dimensions: IDeclaredDimension[] = [];
  for (const dim of dims) {
    const sizeExpr = dim.expression();
    if (!sizeExpr) {
      // Unsized `[]` -- size is not knowable here.
      return { isArray: true, dimensions: undefined };
    }
    // Always a size or the dimension as written -- never undefined -- so every
    // slot is filled and positions are preserved.
    dimensions.push(DimensionResolver.resolve(sizeExpr));
  }

  return { isArray: true, dimensions };
}

/**
 * Process string type fields and update dimensions array.
 */
function processStringField(
  stringCtx: Parser.StringTypeContext,
  arrayDims: Parser.ArrayDimensionContext[],
  dimensions: IDeclaredDimension[],
): boolean {
  const intLiteral = stringCtx.INTEGER_LITERAL();
  if (!intLiteral) {
    return false;
  }

  const capacity = Number.parseInt(intLiteral.getText(), 10);

  // If there are array dimensions, they come BEFORE string capacity
  if (arrayDims.length > 0) {
    parseArrayDimensions(arrayDims, dimensions);
  }
  // String capacity becomes final dimension (+1 for null terminator)
  dimensions.push({ size: capacity + 1, expr: null });
  return true;
}

/**
 * Parse array dimension expressions and append resolved sizes to dimensions array.
 */
function parseArrayDimensions(
  arrayDims: Parser.ArrayDimensionContext[],
  dimensions: IDeclaredDimension[],
): void {
  for (const dim of arrayDims) {
    const sizeExpr = dim.expression();
    if (sizeExpr) {
      dimensions.push(DimensionResolver.resolve(sizeExpr));
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
   * @param isScopeType ADR-057 predicate: is this *qualified* name a scope type?
   * @returns The struct symbol with TType-based types and scope reference
   */
  static collect(
    ctx: Parser.StructDeclarationContext,
    sourceFile: string,
    scopePath: string,
    visibility: TVisibility,
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
    isScopeType?: (qualifiedName: string) => boolean,
  ): IStructFieldSymbol {
    const typeCtx = member.type();
    const fieldType = TypeUtils.resolveType(typeCtx, scopePath, isScopeType);
    // Note: C-Next struct members don't have const modifier in grammar
    const isConst = false;
    // C-Next struct members don't have atomic modifier
    const isAtomic = false;

    const arrayDims = member.arrayDimension();
    const dimensions: IDeclaredDimension[] = [];
    let isArray = false;

    // Check for C-Next style arrayType syntax: Item[3] items -> typeCtx.arrayType()
    const arrayTypeResult = processArrayTypeSyntax(typeCtx.arrayType());
    if (arrayTypeResult.isArray) {
      isArray = true;
      if (arrayTypeResult.dimensions !== undefined) {
        dimensions.push(...arrayTypeResult.dimensions);
      }
      // dimensions is undefined only for an unsized `[]` or no dimensions at
      // all; one that does not fold here (global.EnumName.COUNT) is kept as
      // written and settled by 1.4 Resolve.
    }

    // Handle string types specially -- `string<N>`, and #1569 the element
    // type of `string<N>[M]`, whose capacity follows the array dimensions
    const stringCtx = typeCtx.stringType() ?? typeCtx.arrayType()?.stringType();
    if (stringCtx) {
      const stringHandled = processStringField(
        stringCtx,
        arrayDims,
        dimensions,
      );
      if (stringHandled) {
        isArray = true;
      }
    } else if (arrayDims.length > 0) {
      // Non-string array
      isArray = true;
      parseArrayDimensions(arrayDims, dimensions);
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
      overflowBehavior: OverflowBehaviorUtils.fromModifier(
        member.overflowModifier(),
      ),
      isArray,
      dimensions:
        dimensions.length > 0 ? dimensions.map((dim) => dim.size) : undefined,
      dimensionExprs:
        dimensions.length > 0 ? dimensions.map((dim) => dim.expr) : undefined,
    };
  }
}

export default StructCollector;
