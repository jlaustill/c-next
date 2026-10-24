/**
 * Issue #1618: the position axis of the matrix.
 *
 * Answers "which part of its statement does this diagnostic report?" from the
 * parse tree, as FixtureContext answers which declaration encloses it. The
 * innermost position wins: an argument inside a ternary arm is a ternary
 * branch, a field inside an array initializer is a struct field initializer.
 */

import * as antlr from "antlr4ng";

import {
  ArgumentListContext,
  ArrayInitializerContext,
  AssignmentStatementContext,
  FieldInitializerContext,
  ForAssignmentContext,
  ForUpdateContext,
  ForVarDeclContext,
  ProgramContext,
  ReturnStatementContext,
  TernaryExpressionContext,
  VariableDeclarationContext,
} from "../../src/cnx/PARSE/2-Parse/grammar/CnxParser";
import FixtureContext from "./FixtureContext";
import TMatrixPosition from "../types/TMatrixPosition";

type TAssignmentNode =
  | AssignmentStatementContext
  | ForAssignmentContext
  | ForUpdateContext;

function assignmentPosition(node: TAssignmentNode): TMatrixPosition {
  if (node.assignmentOperator().getText() !== "<-") {
    return "compound-assignment";
  }
  const last = node.assignmentTarget().postfixTargetOp().at(-1);
  if (last === undefined) return "assignment";
  return last.LBRACKET() === null
    ? "struct-field-assignment"
    : "array-element-assignment";
}

/** The position `node` gives a diagnostic at `line`:`column` inside it. */
function positionOf(
  node: antlr.ParserRuleContext,
  line: number,
  column: number,
): TMatrixPosition | null {
  const inside = (value: antlr.ParserRuleContext | null): boolean =>
    value !== null && FixtureContext.spans(value, line, column);

  if (node instanceof TernaryExpressionContext) {
    if (node.COLON() === null) return null;
    return inside(node.orExpression(1)) || inside(node.orExpression(2))
      ? "ternary-branch"
      : null;
  }
  if (node instanceof FieldInitializerContext) {
    return "struct-field-initializer";
  }
  if (node instanceof ArrayInitializerContext) {
    return "array-element-initializer";
  }
  if (node instanceof ArgumentListContext) return "call-argument";
  if (node instanceof ReturnStatementContext) return "return-statement";
  if (
    node instanceof AssignmentStatementContext ||
    node instanceof ForAssignmentContext ||
    node instanceof ForUpdateContext
  ) {
    return inside(node.expression()) ? assignmentPosition(node) : null;
  }
  if (
    node instanceof VariableDeclarationContext ||
    node instanceof ForVarDeclContext
  ) {
    return inside(node.expression()) ? "declaration-initializer" : null;
  }
  return null;
}

/** Innermost position enclosing `line`:`column`, or null outside any. */
function at(
  tree: ProgramContext,
  line: number,
  column: number,
): TMatrixPosition | null {
  let found: TMatrixPosition | null = null;

  const visit = (node: antlr.ParseTree): void => {
    if (node instanceof antlr.ParserRuleContext) {
      if (FixtureContext.spans(node, line, column)) {
        found = positionOf(node, line, column) ?? found;
      } else if (node.start !== null && node.stop !== null) {
        return;
      }
    }
    for (let index = 0; index < node.getChildCount(); index += 1) {
      const child = node.getChild(index);
      if (child !== null) visit(child);
    }
  };

  visit(tree);
  return found;
}

class FixturePosition {
  static at = at;
}

export default FixturePosition;
