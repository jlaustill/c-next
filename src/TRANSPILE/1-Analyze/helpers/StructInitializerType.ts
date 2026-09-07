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
    const typeText =
      init.IDENTIFIER()?.getText() ??
      StructInitializerType.expectedTypeText(init, frame, operands);
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
   * The type an inferred initializer must take, read off the nearest
   * establishing ancestor, or null when it stands somewhere no type reaches
   * it (a subscript, a bare expression statement).
   */
  private static expectedTypeText(
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
    const index = args
      .expression()
      .findIndex((e: ParserRuleContext) => e === argument);
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
