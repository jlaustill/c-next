import type { ParserRuleContext } from "antlr4ng";
import * as Parser from "./grammar/CNextParser";
import SyntaxLowering from "./SyntaxLowering";
import ParserUtils from "../../utils/ParserUtils";
import invariant from "../../utils/invariant";
import ASSIGNMENT_OPERATORS from "../../types/syntax/ASSIGNMENT_OPERATORS";
import type IAssignmentSyntax from "../../types/syntax/IAssignmentSyntax";
import type IVariableDeclarationSyntax from "../../types/syntax/IVariableDeclarationSyntax";
import type TAssignmentOperator from "../../types/syntax/TAssignmentOperator";
import type TCaseLabelSyntax from "../../types/syntax/TCaseLabelSyntax";
import type TExpression from "../../types/syntax/TExpression";
import type TStatement from "../../types/syntax/TStatement";
import type TBlockSyntax from "../../types/syntax/TBlockSyntax";

const ASSIGNMENT_OPERATOR_SET: ReadonlySet<string> = new Set(
  ASSIGNMENT_OPERATORS,
);

/**
 * Statements as plain data (#1932), beside `SyntaxLowering`'s expressions and
 * types. Like it, this decides nothing: it records what was written, one kind
 * per `statement` alternative.
 */
class StatementLowering {
  static block(ctx: Parser.BlockContext): TBlockSyntax {
    return {
      statements: ctx.statement().map((s) => StatementLowering.statement(s)),
      ...SyntaxLowering.node(ctx),
    };
  }

  static statement(ctx: Parser.StatementContext): TStatement {
    const node = SyntaxLowering.node(ctx);
    const declaration = ctx.variableDeclaration();
    if (declaration) return StatementLowering.declaration(declaration);
    const assignment = ctx.assignmentStatement();
    if (assignment) {
      return {
        kind: "assignment",
        ...StatementLowering.assignment(assignment),
      };
    }
    const expression = ctx.expressionStatement();
    if (expression) {
      return {
        kind: "expression",
        expression: StatementLowering.expressionOf(expression),
        ...node,
      };
    }
    return StatementLowering.control(ctx) ?? StatementLowering.nested(ctx);
  }

  static assignment(
    ctx:
      | Parser.AssignmentStatementContext
      | Parser.ForAssignmentContext
      | Parser.ForUpdateContext,
  ): IAssignmentSyntax {
    const operator = ctx.assignmentOperator().getText();
    invariant(
      ASSIGNMENT_OPERATOR_SET.has(operator),
      `'${operator}' is one of the grammar's assignment operators`,
    );
    return {
      target: SyntaxLowering.assignmentTarget(ctx.assignmentTarget()),
      operator: operator as TAssignmentOperator,
      operatorSpan: ParserUtils.getSpan(ctx.assignmentOperator()),
      value: StatementLowering.expressionOf(ctx),
      ...SyntaxLowering.node(ctx),
    };
  }

  static variableDeclaration(
    ctx: Parser.VariableDeclarationContext | Parser.ForVarDeclContext,
  ): IVariableDeclarationSyntax {
    const identifier = ctx.IDENTIFIER();
    const overflow = ctx.overflowModifier()?.getText() ?? null;
    return {
      modifiers: {
        atomic: ctx.atomicModifier() !== null,
        volatile: ctx.volatileModifier() !== null,
        const:
          ctx instanceof Parser.VariableDeclarationContext &&
          ctx.constModifier() !== null,
        overflow: overflow === "clamp" || overflow === "wrap" ? overflow : null,
      },
      type: SyntaxLowering.type(ctx.type()),
      name: identifier.getText(),
      nameSpan: ParserUtils.getSpan({
        start: identifier.symbol,
        stop: identifier.symbol,
      }),
      dimensions: ctx.arrayDimension().map((dimension) => {
        const size = dimension.expression();
        return size ? SyntaxLowering.expression(size) : null;
      }),
      initializer: StatementLowering.optionalExpression(ctx.expression()),
      ...SyntaxLowering.node(ctx),
    };
  }

  private static declaration(
    ctx: Parser.VariableDeclarationContext,
  ): TStatement {
    const constructorArguments = ctx.constructorArgumentList();
    if (!constructorArguments) {
      return {
        kind: "variableDeclaration",
        ...StatementLowering.variableDeclaration(ctx),
      };
    }
    return {
      kind: "constructorDeclaration",
      type: SyntaxLowering.type(ctx.type()),
      name: ctx.IDENTIFIER().getText(),
      arguments: constructorArguments.IDENTIFIER().map((argument) => ({
        name: argument.getText(),
        span: ParserUtils.getSpan({
          start: argument.symbol,
          stop: argument.symbol,
        }),
        written: argument.getText(),
      })),
      ...SyntaxLowering.node(ctx),
    };
  }

  private static control(ctx: Parser.StatementContext): TStatement | null {
    const node = SyntaxLowering.node(ctx);
    const ifStatement = ctx.ifStatement();
    if (ifStatement) {
      const [whenTrue, whenFalse] = ifStatement.statement();
      return {
        kind: "if",
        condition: StatementLowering.expressionOf(ifStatement),
        whenTrue: StatementLowering.statement(whenTrue),
        whenFalse: whenFalse ? StatementLowering.statement(whenFalse) : null,
        ...node,
      };
    }
    const whileStatement = ctx.whileStatement();
    if (whileStatement) {
      return {
        kind: "while",
        condition: StatementLowering.expressionOf(whileStatement),
        body: StatementLowering.statement(whileStatement.statement()),
        ...node,
      };
    }
    const doWhile = ctx.doWhileStatement();
    if (doWhile) {
      return {
        kind: "doWhile",
        body: StatementLowering.block(doWhile.block()),
        condition: StatementLowering.expressionOf(doWhile),
        ...node,
      };
    }
    const forStatement = ctx.forStatement();
    if (forStatement) return StatementLowering.forLoop(forStatement, ctx);
    const forever = ctx.foreverStatement();
    if (forever) {
      return {
        kind: "forever",
        body: StatementLowering.block(forever.block()),
        ...node,
      };
    }
    const switchStatement = ctx.switchStatement();
    if (switchStatement)
      return StatementLowering.switchOf(switchStatement, ctx);
    const returnStatement = ctx.returnStatement();
    if (returnStatement) {
      return {
        kind: "return",
        value: StatementLowering.optionalExpression(
          returnStatement.expression(),
        ),
        ...node,
      };
    }
    return null;
  }

  private static nested(ctx: Parser.StatementContext): TStatement {
    const node = SyntaxLowering.node(ctx);
    const critical = ctx.criticalStatement();
    if (critical) {
      return {
        kind: "critical",
        body: StatementLowering.block(critical.block()),
        ...node,
      };
    }
    const block = ctx.block();
    return {
      kind: "block",
      statements: block
        ? block.statement().map((s) => StatementLowering.statement(s))
        : [],
      ...node,
    };
  }

  private static forLoop(
    ctx: Parser.ForStatementContext,
    statement: Parser.StatementContext,
  ): TStatement {
    const init = ctx.forInit();
    const declaration = init?.forVarDecl();
    const assignment = init?.forAssignment();
    const update = ctx.forUpdate();
    return {
      kind: "for",
      init: declaration
        ? {
            kind: "variableDeclaration",
            ...StatementLowering.variableDeclaration(declaration),
          }
        : assignment
          ? { kind: "assignment", ...StatementLowering.assignment(assignment) }
          : null,
      condition: StatementLowering.optionalExpression(ctx.expression()),
      update: update ? StatementLowering.assignment(update) : null,
      body: StatementLowering.statement(ctx.statement()),
      ...SyntaxLowering.node(statement),
    };
  }

  private static switchOf(
    ctx: Parser.SwitchStatementContext,
    statement: Parser.StatementContext,
  ): TStatement {
    const defaultCase = ctx.defaultCase();
    return {
      kind: "switch",
      subject: StatementLowering.expressionOf(ctx),
      cases: ctx.switchCase().map((switchCase) => ({
        labels: switchCase
          .caseLabel()
          .map((label) => StatementLowering.caseLabel(label)),
        body: StatementLowering.block(switchCase.block()),
        ...SyntaxLowering.node(switchCase),
      })),
      defaultCase: defaultCase
        ? {
            count: defaultCase.INTEGER_LITERAL()?.getText() ?? null,
            body: StatementLowering.block(defaultCase.block()),
            ...SyntaxLowering.node(defaultCase),
          }
        : null,
      ...SyntaxLowering.node(statement),
    };
  }

  static caseLabel(ctx: Parser.CaseLabelContext): TCaseLabelSyntax {
    const node = SyntaxLowering.node(ctx);
    const negative = ctx.children?.[0]?.getText() === "-";
    const qualified = ctx.qualifiedType();
    if (qualified) {
      return {
        kind: "qualified",
        path: qualified.IDENTIFIER().map((id) => id.getText()),
        ...node,
      };
    }
    const identifier = ctx.IDENTIFIER();
    if (identifier) {
      return { kind: "identifier", name: identifier.getText(), ...node };
    }
    const integer = ctx.INTEGER_LITERAL();
    if (integer) {
      return { kind: "integer", text: integer.getText(), negative, ...node };
    }
    const hex = ctx.HEX_LITERAL();
    if (hex) return { kind: "hex", text: hex.getText(), negative, ...node };
    const binary = ctx.BINARY_LITERAL();
    if (binary) return { kind: "binary", text: binary.getText(), ...node };
    const char = ctx.CHAR_LITERAL();
    if (char) return { kind: "char", text: char.getText(), ...node };
    return { kind: "missing", ...node };
  }

  /** A required `expression` child; a recovered parse may still lack it */
  private static expressionOf(
    ctx: ParserRuleContext & { expression(): Parser.ExpressionContext | null },
  ): TExpression {
    const expression = ctx.expression();
    return expression
      ? SyntaxLowering.expression(expression)
      : SyntaxLowering.missing(ctx);
  }

  private static optionalExpression(
    ctx: Parser.ExpressionContext | null,
  ): TExpression | null {
    return ctx ? SyntaxLowering.expression(ctx) : null;
  }
}

export default StatementLowering;
