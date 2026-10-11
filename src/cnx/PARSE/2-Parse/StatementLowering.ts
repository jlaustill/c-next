import type { ParserRuleContext, TerminalNode } from "antlr4ng";
import * as Parser from "./grammar/CNextParser";
import SyntaxLowering from "./SyntaxLowering";
import ParserUtils from "../../utils/ParserUtils";
import invariant from "../../utils/invariant";
import type ISourceSpan from "../../types/ISourceSpan";
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
    if (declaration) {
      return StatementLowering.isWholeDeclaration(declaration)
        ? StatementLowering.declaration(declaration)
        : StatementLowering.missing(ctx);
    }
    const assignment = ctx.assignmentStatement();
    if (assignment) {
      const lowered = StatementLowering.assignmentOrNull(assignment);
      return lowered
        ? { kind: "assignment", ...lowered }
        : StatementLowering.missing(ctx);
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
    const lowered = StatementLowering.assignmentOrNull(ctx);
    invariant(
      lowered !== null,
      `'${ctx.getText()}' has a target and one of the grammar's assignment operators -- only a repaired parse lacks them`,
    );
    return lowered;
  }

  /** The assignment, or null when the parser repaired its target or operator */
  private static assignmentOrNull(
    ctx:
      | Parser.AssignmentStatementContext
      | Parser.ForAssignmentContext
      | Parser.ForUpdateContext,
  ): IAssignmentSyntax | null {
    const target = ctx.assignmentTarget();
    const operatorCtx = ctx.assignmentOperator();
    if (!target || !operatorCtx) return null;
    const operator = operatorCtx.getText();
    if (!ASSIGNMENT_OPERATOR_SET.has(operator)) return null;
    return {
      target: SyntaxLowering.assignmentTarget(target),
      operator: operator as TAssignmentOperator,
      operatorSpan: ParserUtils.getSpan(operatorCtx),
      value: StatementLowering.expressionOf(ctx),
      ...SyntaxLowering.node(ctx),
    };
  }

  /** A declaration with its type and a name the parser did not invent */
  private static isWholeDeclaration(ctx: {
    type(): Parser.TypeContext | null;
    IDENTIFIER(): { readonly symbol: { readonly tokenIndex: number } } | null;
  }): boolean {
    const identifier = ctx.IDENTIFIER();
    return (
      ctx.type() !== null &&
      identifier !== null &&
      identifier.symbol.tokenIndex >= 0
    );
  }

  private static missing(ctx: ParserRuleContext): TStatement {
    return { kind: "missing", ...SyntaxLowering.node(ctx) };
  }

  /** A required statement child; a repaired parse may lack it */
  private static statementOrMissing(
    child: Parser.StatementContext | null | undefined,
    parent: ParserRuleContext,
  ): TStatement {
    return child
      ? StatementLowering.statement(child)
      : StatementLowering.missing(parent);
  }

  /** Where a declaration's name is written; a use binds to it from inside */
  private static nameSpan(identifier: TerminalNode): ISourceSpan {
    return ParserUtils.getSpan({
      start: identifier.symbol,
      stop: identifier.symbol,
    });
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
      nameSpan: StatementLowering.nameSpan(identifier),
      dimensions: ctx.arrayDimension().map((dimension) => {
        const size = dimension.expression();
        return size ? SyntaxLowering.expression(size) : null;
      }),
      initializer: StatementLowering.optionalExpression(ctx.expression()),
      ...SyntaxLowering.node(ctx),
    };
  }

  static declaration(
    ctx: Parser.VariableDeclarationContext,
  ): Extract<
    TStatement,
    { kind: "variableDeclaration" | "constructorDeclaration" }
  > {
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
      nameSpan: StatementLowering.nameSpan(ctx.IDENTIFIER()),
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
        whenTrue: StatementLowering.statementOrMissing(whenTrue, ifStatement),
        whenFalse: whenFalse ? StatementLowering.statement(whenFalse) : null,
        ...node,
      };
    }
    const whileStatement = ctx.whileStatement();
    if (whileStatement) {
      return {
        kind: "while",
        condition: StatementLowering.expressionOf(whileStatement),
        body: StatementLowering.statementOrMissing(
          whileStatement.statement(),
          whileStatement,
        ),
        ...node,
      };
    }
    const doWhile = ctx.doWhileStatement();
    if (doWhile) {
      if (!doWhile.block()) return StatementLowering.missing(ctx);
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
      if (!forever.block()) return StatementLowering.missing(ctx);
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
      if (!critical.block()) return StatementLowering.missing(ctx);
      return {
        kind: "critical",
        body: StatementLowering.block(critical.block()),
        ...node,
      };
    }
    const block = ctx.block();
    if (!block) return StatementLowering.missing(ctx);
    return {
      kind: "block",
      statements: block.statement().map((s) => StatementLowering.statement(s)),
      ...node,
    };
  }

  private static forLoop(
    ctx: Parser.ForStatementContext,
    statement: Parser.StatementContext,
  ): TStatement {
    const init = StatementLowering.forInitOf(ctx.forInit());
    const updateCtx = ctx.forUpdate();
    const update = updateCtx
      ? StatementLowering.assignmentOrNull(updateCtx)
      : null;
    if (init === undefined || (updateCtx && update === null)) {
      return StatementLowering.missing(statement);
    }
    return {
      kind: "for",
      init,
      condition: StatementLowering.optionalExpression(ctx.expression()),
      update,
      body: StatementLowering.statementOrMissing(ctx.statement(), ctx),
      ...SyntaxLowering.node(statement),
    };
  }

  /** The for header's init; undefined when the parser repaired it */
  private static forInitOf(
    init: Parser.ForInitContext | null,
  ): Extract<TStatement, { kind: "for" }>["init"] | undefined {
    const declaration = init?.forVarDecl();
    if (declaration) {
      return StatementLowering.isWholeDeclaration(declaration)
        ? {
            kind: "variableDeclaration",
            ...StatementLowering.variableDeclaration(declaration),
          }
        : undefined;
    }
    const assignment = init?.forAssignment();
    if (!assignment) return null;
    const lowered = StatementLowering.assignmentOrNull(assignment);
    return lowered ? { kind: "assignment", ...lowered } : undefined;
  }

  private static switchOf(
    ctx: Parser.SwitchStatementContext,
    statement: Parser.StatementContext,
  ): TStatement {
    const defaultCase = ctx.defaultCase();
    if (
      ctx.switchCase().some((switchCase) => !switchCase.block()) ||
      (defaultCase && !defaultCase.block())
    ) {
      return StatementLowering.missing(statement);
    }
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
