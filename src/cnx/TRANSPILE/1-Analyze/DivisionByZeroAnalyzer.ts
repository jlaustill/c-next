/**
 * Division By Zero Analyzer
 * Detects division and modulo by zero at compile time (ADR-051)
 *
 * A divisor that is a compile-time constant zero, integer or float (§1, §4):
 * a literal (`0`, `0.0f32`), a const (`ZERO`, `this.ZERO`, `Scope.ZERO`) or
 * a constant expression (`2 - 2`, `-0.0`, `(f32)0`), by the one constant
 * fold, so a name means the declaration ADR-057 names wherever the division
 * is written -- a statement, a member or file initializer, an array dimension,
 * an enum member's value (#1664 box 7, #1268).
 */

import type IProgramSyntax from "../../types/syntax/IProgramSyntax";
import type TDeclarationSyntax from "../../types/syntax/TDeclarationSyntax";
import type TExpression from "../../types/syntax/TExpression";
import type TStatement from "../../types/syntax/TStatement";
import DeclarationParts from "../../utils/DeclarationParts";
import ExpressionNodes from "../../utils/ExpressionNodes";
import StatementChildren from "../../utils/StatementChildren";
import IDivisionByZeroError from "./types/IDivisionByZeroError";
import OperandTyper from "../../utils/OperandTyper";
import ConstantFold from "../../utils/ConstantFold";
import ConstExprLowering from "../../utils/ConstExprLowering";
import type IAnalysisContext from "./types/IAnalysisContext";

type TBinary = Extract<TExpression, { readonly kind: "binary" }>;

/** #1991: reads 1.2's syntax, not the parse tree */
class DivisionByZeroAnalyzer {
  constructor(private readonly context: IAnalysisContext) {}

  private errors: IDivisionByZeroError[] = [];

  public analyze(program: IProgramSyntax): IDivisionByZeroError[] {
    this.errors = [];
    for (const member of program.declarations) {
      this.declaration(member.declaration);
    }
    return this.errors;
  }

  private declaration(declaration: TDeclarationSyntax): void {
    if (declaration.kind === "scope") {
      for (const member of declaration.members) {
        this.declaration(member.declaration);
      }
      return;
    }
    const atRunTime = new Set(
      declaration.kind === "function"
        ? DivisionByZeroAnalyzer.runTimeRoots(
            declaration.body.statements,
          ).flatMap(ExpressionNodes.direct)
        : [],
    );
    for (const part of DeclarationParts.of(declaration)) {
      for (const expr of ExpressionNodes.of(part)) {
        if (expr.kind === "binary") this.check(expr, atRunTime.has(expr));
      }
    }
  }

  private check(expr: TBinary, atRunTime: boolean): void {
    expr.operators.forEach((operator, i) => {
      if (operator !== "/" && operator !== "%") return;
      const divisor = expr.operands[i + 1];
      if (this.isZero(divisor)) {
        this.addError(
          operator,
          divisor.span.line,
          divisor.span.column,
          atRunTime,
        );
      }
    });
  }

  private isZero(divisor: TExpression): boolean {
    const numeric = OperandTyper.valueLeaves(divisor, this.context).every(
      (leaf) =>
        leaf === null ||
        (leaf.enumTypeName == null && leaf.category !== "boolean"),
    );
    return (
      numeric &&
      ConstantFold.numberValue(
        this.context.program,
        this.context.sourceFile,
        ConstExprLowering.lower(divisor),
      ) === 0
    );
  }

  /**
   * Whether a `safe_div` call could replace a division: in a statement, and
   * not in what must be known at compile time there -- an array dimension, an
   * enum member's value, a const's initializer (#1268 review)
   */
  private static runTimeRoots(
    statements: readonly TStatement[],
  ): readonly TExpression[] {
    const compileTime = new Set(
      statements
        .flatMap(DivisionByZeroAnalyzer.allStatements)
        .flatMap(DivisionByZeroAnalyzer.compileTimeRoots),
    );
    return DeclarationParts.statements(statements).flatMap((part) =>
      part.kind === "expression" && !compileTime.has(part.expression)
        ? [part.expression]
        : [],
    );
  }

  private static allStatements(statement: TStatement): readonly TStatement[] {
    return [
      statement,
      ...StatementChildren.of(statement).flatMap(
        DivisionByZeroAnalyzer.allStatements,
      ),
    ];
  }

  /** A local's dimensions, and a const local's value */
  private static compileTimeRoots(
    statement: TStatement,
  ): readonly TExpression[] {
    if (statement.kind === "for") {
      return statement.init === null
        ? []
        : DivisionByZeroAnalyzer.compileTimeRoots(statement.init);
    }
    if (statement.kind !== "variableDeclaration") return [];
    return [
      ...statement.dimensions.filter((d): d is TExpression => d !== null),
      ...(statement.modifiers.const && statement.initializer !== null
        ? [statement.initializer]
        : []),
    ];
  }

  private addError(
    operator: string,
    line: number,
    column: number,
    atRunTime: boolean,
  ): void {
    const isDivision = operator === "/";
    const code = isDivision ? "E0800" : "E0802";
    const opName = isDivision ? "Division" : "Modulo";
    const builtin = isDivision ? "safe_div" : "safe_mod";

    this.errors.push({
      code,
      operator,
      line,
      column,
      message: `${opName} by zero`,
      helpText: atRunTime
        ? `Consider using ${builtin}(output, numerator, divisor, defaultValue) for runtime safety`
        : "A divisor known at compile time must not be zero",
    });
  }
}

export default DivisionByZeroAnalyzer;
