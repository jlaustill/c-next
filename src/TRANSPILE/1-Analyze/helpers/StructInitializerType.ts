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

import * as Parser from "../../../transpiler/logic/parser/grammar/CNextParser";
import CodeGenState from "../../../transpiler/state/CodeGenState";
import TypeResolver from "../../../utils/TypeResolver";
import OperandTypeResolver from "../OperandTypeResolver";
import IScopeFrame from "../types/IScopeFrame";
import FunctionReference from "./FunctionReference";

class StructInitializerType {
  /** The struct's C name, or null when nothing establishes one. */
  static of(
    init: Parser.StructInitializerContext,
    frame: IScopeFrame,
    operands: OperandTypeResolver,
  ): string | null {
    const typeText = StructInitializerType.establishedTypeText(
      init,
      frame,
      operands,
    );
    return typeText === null
      ? null
      : StructInitializerType.structNamed(typeText, frame.scopePath);
  }

  /** The struct a type spelling names, as keyed in `structFields`, or null. */
  static structNamed(typeText: string, scopePath: string): string | null {
    const fields = CodeGenState.symbols?.structFields;
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
  static hasEstablishingPosition(
    init: Parser.StructInitializerContext,
  ): boolean {
    let cursor: ParserRuleContext | null = init.parent;
    while (cursor) {
      // A subscript's expression is reached before any declaration above it,
      // and nothing there supplies a struct type.
      if (cursor instanceof Parser.PostfixOpContext) return false;
      if (
        cursor instanceof Parser.VariableDeclarationContext ||
        cursor instanceof Parser.ForVarDeclContext ||
        cursor instanceof Parser.FieldInitializerContext ||
        cursor instanceof Parser.AssignmentStatementContext ||
        cursor instanceof Parser.ReturnStatementContext ||
        cursor instanceof Parser.ArgumentListContext
      ) {
        return true;
      }
      cursor = cursor.parent;
    }
    return false;
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
    frame: IScopeFrame,
    operands: OperandTypeResolver,
  ): string | null {
    let child: ParserRuleContext = init;
    let cursor: ParserRuleContext | null = init.parent;
    while (cursor) {
      const established = StructInitializerType.typeEstablishedBy(
        cursor,
        child,
        frame,
        operands,
      );
      if (established !== undefined) return established;
      child = cursor;
      cursor = cursor.parent;
    }
    return null;
  }

  /**
   * What one ancestor says: a type text, null for "nothing can reach here",
   * or undefined for "not an establishing node -- keep climbing".
   */
  private static typeEstablishedBy(
    cursor: ParserRuleContext,
    child: ParserRuleContext,
    frame: IScopeFrame,
    operands: OperandTypeResolver,
  ): string | null | undefined {
    if (
      cursor instanceof Parser.VariableDeclarationContext ||
      cursor instanceof Parser.ForVarDeclContext
    ) {
      return cursor.type()?.getText() ?? null;
    }
    if (cursor instanceof Parser.FieldInitializerContext) {
      return StructInitializerType.fieldType(cursor, frame, operands);
    }
    if (cursor instanceof Parser.AssignmentStatementContext) {
      return operands.typeOfAssignmentTarget(cursor.assignmentTarget(), frame);
    }
    if (cursor instanceof Parser.ReturnStatementContext) {
      return StructInitializerType.enclosingReturnType(cursor);
    }
    if (cursor instanceof Parser.ArgumentListContext) {
      return StructInitializerType.parameterType(cursor, child, frame);
    }
    if (cursor instanceof Parser.PostfixOpContext) {
      return null; // a subscript's expression: no struct is expected there
    }
    return undefined;
  }

  /** The declared type of the field an enclosing initializer is setting. */
  private static fieldType(
    field: Parser.FieldInitializerContext,
    frame: IScopeFrame,
    operands: OperandTypeResolver,
  ): string | null {
    const outer = field.parent?.parent;
    if (!(outer instanceof Parser.StructInitializerContext)) return null;
    const structName = StructInitializerType.of(outer, frame, operands);
    if (structName === null) return null;
    return (
      CodeGenState.symbols?.structFields
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
    frame: IScopeFrame,
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
    const callee = FunctionReference.ofCall(postfix, frame.scopePath);
    const param = callee?.parameters[index];
    return param === undefined ? null : TypeResolver.getTypeName(param.type);
  }
}

export default StructInitializerType;
