/**
 * String Value Target Analyzer
 *
 * ADR-024 "Where a conversion is checked": wherever a value meets a typed
 * target. A string -- a literal, or a `string<N>` value (ADR-045) -- is not an
 * integer, a float or a bool, so it lands in none of them: E0914 (#1739).
 *
 * Every such position was accepted at exit 0. `u32 g <- "hello";` emitted
 * `uint32_t g = "hello";`, a pointer converted to an integer, and a private
 * scope const `const u32 N <- "abc"` reached each use as `"abc"`.
 *
 * Checked at each position a value's type comes from (the one
 * `StructInitializerType.valueType` reads): a declaration's initializer, an
 * assignment, an argument, a return, a field and an array element. A whole
 * array is no such position, so ADR-035's `u8[] buf <- "abc"` is untouched.
 */

import { ParseTreeWalker, ParserRuleContext } from "antlr4ng";
import { CNextListener } from "../../PARSE/2-Parse/grammar/CNextListener";
import * as Parser from "../../PARSE/2-Parse/grammar/CNextParser";
import SyntaxLowering from "../../PARSE/2-Parse/SyntaxLowering";
import OperandTyper from "../../utils/OperandTyper";
import ExpressionShape from "../../utils/ExpressionShape";
import TypeCheckUtils from "../../utils/TypeCheckUtils";
import AssignmentSiteListener from "./AssignmentSiteListener";
import StructInitializerType from "./helpers/StructInitializerType";
import type IBaseAnalysisError from "./types/IBaseAnalysisError";
import type IAnalysisContext from "./types/IAnalysisContext";
import type TAssignmentSite from "../../types/TAssignmentSite";

class StringValueTargetListener extends CNextListener {
  readonly errors: IBaseAnalysisError[] = [];

  constructor(private readonly context: IAnalysisContext) {
    super();
  }

  override enterVariableDeclaration = (
    ctx: Parser.VariableDeclarationContext,
  ): void => {
    this.check(ctx.expression());
  };

  override enterForVarDecl = (ctx: Parser.ForVarDeclContext): void => {
    this.check(ctx.expression());
  };

  checkSite(site: TAssignmentSite): void {
    this.check(site.expression());
  }

  override enterArgumentList = (ctx: Parser.ArgumentListContext): void => {
    for (const argument of ctx.expression()) this.check(argument);
  };

  override enterReturnStatement = (
    ctx: Parser.ReturnStatementContext,
  ): void => {
    this.check(ctx.expression());
  };

  override enterFieldInitializer = (
    ctx: Parser.FieldInitializerContext,
  ): void => {
    this.check(ctx.expression());
  };

  override enterArrayInitializer = (
    ctx: Parser.ArrayInitializerContext,
  ): void => {
    this.check(ctx.expression());
    for (const element of ctx.arrayInitializerElement()) {
      this.check(element.expression());
    }
  };

  private check(value: ParserRuleContext | null): void {
    if (!value) return;
    const target = StructInitializerType.valueType(value, this.context);
    if (target === null || !StringValueTargetListener.isScalar(target)) return;
    const lowered = SyntaxLowering.expressionNode(value);
    if (
      !ExpressionShape.isStringLiteral(lowered) &&
      !OperandTyper.isScalarString(OperandTyper.typeOf(lowered, this.context))
    ) {
      return;
    }
    this.errors.push({
      code: "E0914",
      line: value.start?.line ?? 0,
      column: value.start?.column ?? 0,
      message: `A string value cannot be assigned to ${target}: '${value.getText()}'`,
      helpText:
        "A string lands only in a string<N> (ADR-045); a u8 array may be initialized by a string literal (ADR-035)",
    });
  }

  /** An integer, a float or a bool: what a string is not */
  private static isScalar(target: string): boolean {
    return (
      TypeCheckUtils.isInteger(target) ||
      TypeCheckUtils.isFloat(target) ||
      target === "bool"
    );
  }
}

class StringValueTargetAnalyzer {
  constructor(private readonly context: IAnalysisContext) {}

  analyze(tree: Parser.ProgramContext): IBaseAnalysisError[] {
    const listener = new StringValueTargetListener(this.context);
    ParseTreeWalker.DEFAULT.walk(listener, tree);
    ParseTreeWalker.DEFAULT.walk(
      new AssignmentSiteListener((site) => listener.checkSite(site)),
      tree,
    );
    return listener.errors;
  }
}

export default StringValueTargetAnalyzer;
