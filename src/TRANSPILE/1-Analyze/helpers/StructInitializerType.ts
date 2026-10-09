/**
 * The struct a `{ field: value }` initializer builds.
 *
 * #1322. An explicit `Point { x: 1 }` says so; an inferred `{ x: 1 }` is typed
 * by where it stands -- a declaration's type, the field it initializes in an
 * enclosing initializer, the element type of the array it sits in, the
 * assignment target, the parameter it is passed to, or the enclosing
 * function's return type. Codegen typed the first three through its
 * `expectedType` control flow and could not type the last (#1277); pass 2.1
 * reads the parse tree, where every establishing node is a parent away.
 *
 * Answers with the C name the per-file view keys struct fields by, so a
 * caller can go straight to `structFields`.
 */

import ParserUtils from "../../../utils/ParserUtils";
import SyntaxLowering from "../../../PARSE/2-Parse/SyntaxLowering";
import { ParserRuleContext } from "antlr4ng";

import * as Parser from "../../../PARSE/2-Parse/grammar/CNextParser";
import TypeResolver from "../../../utils/TypeResolver";
import OperandTyper from "../../../utils/OperandTyper";
import TypeCheckUtils from "../../../utils/TypeCheckUtils";
import DeclaredTypeFacts from "../../../utils/DeclaredTypeFacts";
import ForeignTypeFacts from "../../../utils/ForeignTypeFacts";
import FunctionReference from "./FunctionReference";
import TypeText from "./TypeText";
import invariant from "../../../utils/invariant";
import type IAnalysisContext from "../types/IAnalysisContext";

/** What an establishing position gives the value under it */
interface IPositionType {
  /** The type's spelling -- a field's or parameter's element type; null
   * when the position cannot name one */
  readonly typeText: string | null;
  /** Whether the position takes a whole array (#1760 second review: only a
   * declaration's spelling carried its dimensions) */
  readonly isArray: boolean;
  /** A declaration, whose whole-array initializer ADR-035's rule checks */
  readonly isDeclaration: boolean;
}

const NO_TYPE: IPositionType = {
  typeText: null,
  isArray: false,
  isDeclaration: false,
};

class StructInitializerType {
  /** The struct's C name, or null when nothing establishes one. */
  static of(
    init: Parser.StructInitializerContext,
    context: IAnalysisContext,
  ): string | null {
    const typeText = StructInitializerType.establishedTypeText(init, context);
    return typeText === null
      ? null
      : StructInitializerType.structNamed(
          typeText,
          OperandTyper.scopePathAt(ParserUtils.getPosition(init), context),
          context,
        );
  }

  /** The struct a type spelling names, as keyed in `structFields`, or null. */
  static structNamed(
    typeText: string,
    scopePath: string,
    context: IAnalysisContext,
  ): string | null {
    const fields = context.symbols.structFields;
    if (!fields) return null;
    return (
      FunctionReference.candidatesForTypeText(typeText, scopePath).find((c) =>
        fields.has(c),
      ) ?? null
    );
  }

  /**
   * Whether ANY enclosing position supplies a type for this initializer,
   * without asking what that type resolves to.
   *
   * ADR-014's two diagnostics need only this. Asking for the resolved NAME
   * conflates "no position supplies a type" with "a position supplies one and
   * this pass cannot name it", and those are opposite answers: the first is
   * E0357, the second must stay silent. The distinction is not hypothetical --
   * a field of a struct declared in an included C header resolves through the
   * C symbols rather than the C-Next view, so `{ flag_a: 1 }` inside
   * `SimpleConfig cfg <- { flags: { flag_a: 1 } }` has a position supplying a
   * type that this pass cannot name, and nine `tests/interop` fixtures say so.
   */
  /**
   * #1802: the type a struct initializer gives a value to, when that type is
   * not a struct. Null when it is a struct, or when this pass does not know
   * the type. An element of an array's list is checked at the element's
   * type, while an array's whole initializer is E0866's.
   *
   * The positive question, asked of each type's one home (#1760 second
   * review): a bitmap first, since `DeclaredTypeFacts.isStruct` counts it
   * struct-like (#551); then a C-Next struct, and a header's struct, union
   * or opaque type. Any other type this pass knows is not a struct. Asking
   * "known NOT to be a struct" let a header's pointer or function-pointer
   * typedef and an ADR-029 function type through, since none has a category.
   */
  static nonStructTarget(
    init: Parser.StructInitializerContext,
    context: IAnalysisContext,
  ): { readonly typeName: string; readonly isBitmap: boolean } | null {
    const established = StructInitializerType.establish(init, context);
    const typeText = established.typeText;
    if (typeText === null) return null;
    if (established.isArray && !established.inList) return null;
    const typeName = TypeText.withoutDimensions(typeText);
    const symbols = context.symbols;
    const candidates = FunctionReference.candidatesForTypeText(
      typeName,
      OperandTyper.scopePathAt(ParserUtils.getPosition(init), context),
    );
    if (candidates.some((c) => DeclaredTypeFacts.isBitmap(symbols, c))) {
      return { typeName, isBitmap: true };
    }
    const isStruct =
      candidates.some((c) =>
        DeclaredTypeFacts.isStruct(symbols, context.symbolTable, c),
      ) ||
      ForeignTypeFacts.isStructType(
        typeName,
        context.symbolTable,
        OperandTyper.target(context),
      );
    if (isStruct) return null;
    return StructInitializerType.isKnownType(typeName, candidates, context)
      ? { typeName, isBitmap: false }
      : null;
  }

  /**
   * Whether this pass knows a type that is not a struct: a primitive or a
   * string, an enum or an ADR-029 function type this file sees, or a type a
   * header declares.
   */
  private static isKnownType(
    typeName: string,
    candidates: readonly string[],
    context: IAnalysisContext,
  ): boolean {
    const symbols = context.symbols;
    return (
      OperandTyper.categoryOf(typeName) !== "none" ||
      TypeCheckUtils.isSizedStringName(typeName) ||
      candidates.some(
        (c) =>
          DeclaredTypeFacts.isEnum(symbols, c) ||
          symbols.functionReturnTypes.has(c),
      ) ||
      ForeignTypeFacts.isForeignType(
        typeName,
        context.symbolTable,
        OperandTyper.target(context),
      )
    );
  }

  static hasEstablishingPosition(
    init: Parser.StructInitializerContext,
  ): boolean {
    let cursor: ParserRuleContext | null = init.parent;
    while (cursor) {
      const position = StructInitializerType.positionOf(cursor);
      if (position !== "neither") return position === "supplies";
      cursor = cursor.parent;
    }
    return false;
  }

  /**
   * What an ancestor is to an initializer below it: a position that supplies
   * its type, a subscript, or neither. A subscript's expression is reached
   * before any declaration above it and supplies no struct type, so it ends
   * the search. The one list of positions, which E0357's structural question
   * and the typed walk both ask. #1802: each held its own copy.
   */
  private static positionOf(
    cursor: ParserRuleContext,
  ): "supplies" | "subscript" | "neither" {
    if (cursor instanceof Parser.PostfixOpContext) return "subscript";
    return cursor instanceof Parser.VariableDeclarationContext ||
      cursor instanceof Parser.ForVarDeclContext ||
      cursor instanceof Parser.FieldInitializerContext ||
      cursor instanceof Parser.AssignmentStatementContext ||
      cursor instanceof Parser.ReturnStatementContext ||
      cursor instanceof Parser.ArgumentListContext
      ? "supplies"
      : "neither";
  }

  /**
   * The type an inferred initializer must take, read off the nearest
   * establishing ancestor, or null when it stands somewhere no type reaches
   * it (a subscript, a bare expression statement).
   *
   * Public because ADR-014's two diagnostics ask exactly this and nothing
   * else: a written type where a position already supplies one is redundant
   * (E0356), and no written type where no position supplies one cannot be
   * resolved (E0357). Codegen asks the same question by threading
   * `expectedType` DOWN as it generates; this walks UP from the literal. Two
   * mechanisms, one rule -- the boundary is stated at both ends, because the
   * renderer may not import an analyzer and the analyzer must not read
   * codegen state.
   */
  static establishedTypeText(
    init: Parser.StructInitializerContext,
    context: IAnalysisContext,
  ): string | null {
    return StructInitializerType.establish(init, context).typeText;
  }

  /**
   * The type a value's position gives it, the way it gives one to an
   * initializer: a declaration's (a `for` header's too), the field it
   * initializes, the element of the array list it sits in, the assignment
   * target's, the parameter it is passed to, or the enclosing function's
   * return type. Null when no position types it, and for a whole-array
   * position. #1760 second review: E0891 asks this of every value, so a
   * float reaches an integer parameter, return, field or element only
   * through a cast, as it reaches a declaration.
   */
  static valueType(
    value: ParserRuleContext,
    context: IAnalysisContext,
  ): string | null {
    const established = StructInitializerType.establish(value, context);
    const typeText = established.typeText;
    if (typeText === null) return null;
    if (established.isArray && !established.inList) return null;
    return TypeText.withoutDimensions(typeText);
  }

  /**
   * Whether a struct initializer stands where a whole array is taken, other
   * than a declaration's initializer, which ADR-035's rule checks itself: a
   * field, an assignment target or a parameter that is an array. ADR-014:
   * an array's whole initializer is ADR-035's list (E0866). #1760 second
   * review: these positions typed the element, so the initializer was
   * E0358's -- or, for an array of structs, emitted as one struct.
   */
  static takesWholeArray(
    init: Parser.StructInitializerContext,
    context: IAnalysisContext,
  ): boolean {
    const established = StructInitializerType.establish(init, context);
    return (
      established.isArray && !established.inList && !established.isDeclaration
    );
  }

  /**
   * The one walk up from a value: what its nearest establishing position
   * gives, and whether an array's list stood between the two. An element of
   * `[{ a: 1 }, 2]` is typed by the element, not the array (#1802).
   */
  private static establish(
    value: ParserRuleContext,
    context: IAnalysisContext,
  ): IPositionType & { readonly inList: boolean } {
    let inList = false;
    let child: ParserRuleContext = value;
    let cursor: ParserRuleContext | null = value.parent;
    while (cursor) {
      const established = StructInitializerType.typeEstablishedBy(
        cursor,
        child,
        context,
      );
      if (established !== undefined) return { ...established, inList };
      if (cursor instanceof Parser.ArrayInitializerContext) inList = true;
      child = cursor;
      cursor = cursor.parent;
    }
    return { ...NO_TYPE, inList };
  }

  /**
   * What one ancestor says, `NO_TYPE` for "nothing can reach here", or
   * undefined for "not an establishing node -- keep climbing".
   */
  private static typeEstablishedBy(
    cursor: ParserRuleContext,
    child: ParserRuleContext,
    context: IAnalysisContext,
  ): IPositionType | undefined {
    const position = StructInitializerType.positionOf(cursor);
    if (position === "neither") return undefined;
    if (position === "subscript") return NO_TYPE; // no struct is expected there
    if (
      cursor instanceof Parser.VariableDeclarationContext ||
      cursor instanceof Parser.ForVarDeclContext
    ) {
      const typeText = cursor.type()?.getText() ?? null;
      const postfixDimensions =
        cursor instanceof Parser.ForVarDeclContext &&
        cursor.arrayDimension().length > 0;
      return {
        typeText,
        isArray:
          postfixDimensions ||
          (typeText !== null &&
            TypeText.withoutDimensions(typeText) !== typeText),
        isDeclaration: true,
      };
    }
    if (cursor instanceof Parser.FieldInitializerContext) {
      return StructInitializerType.fieldPosition(cursor, context);
    }
    if (cursor instanceof Parser.AssignmentStatementContext) {
      const target = OperandTyper.typeOfTarget(
        SyntaxLowering.assignmentTarget(cursor.assignmentTarget()),
        context,
      );
      return {
        typeText: target?.typeName ?? null,
        isArray: (target?.dimensions.length ?? 0) > 0,
        isDeclaration: false,
      };
    }
    if (cursor instanceof Parser.ReturnStatementContext) {
      return {
        typeText: StructInitializerType.enclosingReturnType(cursor),
        isArray: false,
        isDeclaration: false,
      };
    }
    invariant(
      cursor instanceof Parser.ArgumentListContext,
      "positionOf supplies only the positions typed above",
    );
    return StructInitializerType.parameterPosition(cursor, child, context);
  }

  /** The declared type of the field an enclosing initializer is setting. */
  static fieldType(
    field: Parser.FieldInitializerContext,
    context: IAnalysisContext,
  ): string | null {
    return StructInitializerType.fieldPosition(field, context).typeText;
  }

  /** The field an enclosing initializer is setting: its type, and whether
   * it is an array */
  private static fieldPosition(
    field: Parser.FieldInitializerContext,
    context: IAnalysisContext,
  ): IPositionType {
    const outer = field.parent?.parent;
    if (!(outer instanceof Parser.StructInitializerContext)) return NO_TYPE;
    const structName = StructInitializerType.of(outer, context);
    if (structName === null) return NO_TYPE;
    const name = field.IDENTIFIER().getText();
    return {
      typeText: context.symbols.structFields.get(structName)?.get(name) ?? null,
      isArray:
        context.symbols.structFieldArrays.get(structName)?.has(name) ?? false,
      isDeclaration: false,
    };
  }

  private static enclosingReturnType(
    at: Parser.ReturnStatementContext,
  ): string | null {
    let cursor: ParserRuleContext | null = at.parent;
    while (cursor && !(cursor instanceof Parser.FunctionDeclarationContext)) {
      cursor = cursor.parent;
    }
    return cursor?.type().getText() ?? null;
  }

  /** The parameter an argument is passed to, if the callee is known */
  private static parameterPosition(
    args: Parser.ArgumentListContext,
    argument: ParserRuleContext,
    context: IAnalysisContext,
  ): IPositionType {
    // `indexOf` needs the array's own element type; an argument that is not
    // an expression is not in the list at all.
    const index =
      argument instanceof Parser.ExpressionContext
        ? args.expression().indexOf(argument)
        : -1;
    const postfix = args.parent?.parent;
    if (index < 0 || !(postfix instanceof Parser.PostfixExpressionContext)) {
      return NO_TYPE;
    }
    const callee = FunctionReference.ofCall(
      postfix,
      OperandTyper.scopePathAt(ParserUtils.getPosition(postfix), context),
      context,
    );
    const param = callee?.parameters[index];
    return param === undefined
      ? NO_TYPE
      : {
          typeText: TypeResolver.getTypeName(param.type),
          isArray: param.isArray,
          isDeclaration: false,
        };
  }
}

export default StructInitializerType;
