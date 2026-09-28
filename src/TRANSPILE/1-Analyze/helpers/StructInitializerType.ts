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
          OperandTyper.scopePathAt(init, context),
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
   * known not to be a struct. That is a primitive or a string, a bitmap or an
   * enum this file sees, or a header's scalar. Null when it is a struct, or
   * when this pass cannot say. An element of an array's list is checked at
   * the element's type, while an array's whole initializer is E0866's. Each
   * question is its type's one home: the typer's category, the file's
   * declared sets, and the header facts.
   */
  static nonStructTarget(
    init: Parser.StructInitializerContext,
    context: IAnalysisContext,
  ): { readonly typeName: string; readonly isBitmap: boolean } | null {
    const established = StructInitializerType.establish(init, context);
    const typeText = established.typeText;
    if (typeText === null) return null;
    const typeName = TypeText.withoutDimensions(typeText);
    if (typeName !== typeText && !established.inList) return null;
    if (
      OperandTyper.categoryOf(typeName) !== "none" ||
      TypeCheckUtils.isSizedStringName(typeName)
    ) {
      return { typeName, isBitmap: false };
    }
    const symbols = context.symbols;
    const named = FunctionReference.candidatesForTypeText(
      typeName,
      OperandTyper.scopePathAt(init, context),
    ).find(
      (c) =>
        DeclaredTypeFacts.isBitmap(symbols, c) ||
        DeclaredTypeFacts.isEnum(symbols, c) ||
        symbols.knownStructs.has(c) ||
        symbols.structFields.has(c),
    );
    if (named !== undefined) {
      if (DeclaredTypeFacts.isBitmap(symbols, named)) {
        return { typeName, isBitmap: true };
      }
      return DeclaredTypeFacts.isEnum(symbols, named)
        ? { typeName, isBitmap: false }
        : null;
    }
    // A header's type: a struct keeps category "none", a scalar has one
    const foreign = ForeignTypeFacts.operandType(
      typeName,
      context.symbolTable,
      OperandTyper.target(context),
    );
    return foreign !== null && foreign.category !== "none"
      ? { typeName, isBitmap: false }
      : null;
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
   * The one walk up from an initializer: the type its nearest establishing
   * position gives, and whether an array's list stood between the two. An
   * element of `[{ a: 1 }, 2]` is typed by the element, not the array
   * (#1802).
   */
  private static establish(
    init: Parser.StructInitializerContext,
    context: IAnalysisContext,
  ): { readonly typeText: string | null; readonly inList: boolean } {
    let inList = false;
    let child: ParserRuleContext = init;
    let cursor: ParserRuleContext | null = init.parent;
    while (cursor) {
      const established = StructInitializerType.typeEstablishedBy(
        cursor,
        child,
        context,
      );
      if (established !== undefined) return { typeText: established, inList };
      if (cursor instanceof Parser.ArrayInitializerContext) inList = true;
      child = cursor;
      cursor = cursor.parent;
    }
    return { typeText: null, inList };
  }

  /**
   * What one ancestor says: a type text, null for "nothing can reach here",
   * or undefined for "not an establishing node -- keep climbing".
   */
  private static typeEstablishedBy(
    cursor: ParserRuleContext,
    child: ParserRuleContext,
    context: IAnalysisContext,
  ): string | null | undefined {
    const position = StructInitializerType.positionOf(cursor);
    if (position === "neither") return undefined;
    if (position === "subscript") return null; // no struct is expected there
    if (
      cursor instanceof Parser.VariableDeclarationContext ||
      cursor instanceof Parser.ForVarDeclContext
    ) {
      return cursor.type()?.getText() ?? null;
    }
    if (cursor instanceof Parser.FieldInitializerContext) {
      return StructInitializerType.fieldType(cursor, context);
    }
    if (cursor instanceof Parser.AssignmentStatementContext) {
      return (
        OperandTyper.typeOfTarget(cursor.assignmentTarget(), context)
          ?.typeName ?? null
      );
    }
    if (cursor instanceof Parser.ReturnStatementContext) {
      return StructInitializerType.enclosingReturnType(cursor);
    }
    invariant(
      cursor instanceof Parser.ArgumentListContext,
      "positionOf supplies only the positions typed above",
    );
    return StructInitializerType.parameterType(cursor, child, context);
  }

  /** The declared type of the field an enclosing initializer is setting. */
  static fieldType(
    field: Parser.FieldInitializerContext,
    context: IAnalysisContext,
  ): string | null {
    const outer = field.parent?.parent;
    if (!(outer instanceof Parser.StructInitializerContext)) return null;
    const structName = StructInitializerType.of(outer, context);
    if (structName === null) return null;
    return (
      context.symbols.structFields
        .get(structName)
        ?.get(field.IDENTIFIER().getText()) ?? null
    );
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

  /** The type of the parameter an argument is passed to, if the callee is known. */
  private static parameterType(
    args: Parser.ArgumentListContext,
    argument: ParserRuleContext,
    context: IAnalysisContext,
  ): string | null {
    // `indexOf` needs the array's own element type; an argument that is not
    // an expression is not in the list at all.
    const index =
      argument instanceof Parser.ExpressionContext
        ? args.expression().indexOf(argument)
        : -1;
    const postfix = args.parent?.parent;
    if (index < 0 || !(postfix instanceof Parser.PostfixExpressionContext)) {
      return null;
    }
    const callee = FunctionReference.ofCall(
      postfix,
      OperandTyper.scopePathAt(postfix, context),
      context,
    );
    const param = callee?.parameters[index];
    return param === undefined ? null : TypeResolver.getTypeName(param.type);
  }
}

export default StructInitializerType;
