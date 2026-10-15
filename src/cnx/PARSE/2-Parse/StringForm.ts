/**
 * ADR-045's string declaration forms (#1322, #1991): a capacity is written or
 * can be inferred (E0862), and a file-scope string is initialized only by a
 * literal (E0863). Both read only how the declaration is written, so 1.2
 * reports them. Whether the initializer fits is 2.1's (E0864/E0865).
 */
import { ParserRuleContext, ParseTreeWalker } from "antlr4ng";
import { CNextListener } from "./grammar/CNextListener";
import * as Parser from "./grammar/CNextParser";
import SyntaxLowering from "./SyntaxLowering";
import ExpressionShape from "../../utils/ExpressionShape";
import ParserUtils from "../../utils/ParserUtils";
import CodedErrorText from "../../utils/CodedErrorText";
import type ITranspileError from "../../types/ITranspileError";
import type TExpression from "../../types/syntax/TExpression";

class StringFormListener extends CNextListener {
  private readonly found: ITranspileError[] = [];
  private functionDepth = 0;

  public errors(): ITranspileError[] {
    return this.found;
  }

  override enterFunctionDeclaration = (): void => {
    this.functionDepth++;
  };

  override exitFunctionDeclaration = (): void => {
    this.functionDepth--;
  };

  override enterVariableDeclaration = (
    ctx: Parser.VariableDeclarationContext,
  ): void => {
    const typeCtx = ctx.type();
    const arrayType = typeCtx.arrayType?.();
    const stringCtx = arrayType?.stringType?.() ?? typeCtx.stringType();
    if (!stringCtx) return;
    const isArray = arrayType?.stringType?.() !== undefined;
    const expression = ctx.expression();
    const initializer = expression
      ? SyntaxLowering.expression(expression)
      : null;
    if (stringCtx.INTEGER_LITERAL() === null) {
      this.checkInferred(
        stringCtx,
        isArray,
        ctx.mutModifier() === null,
        expression,
        initializer,
      );
      return;
    }
    if (isArray || expression === null || initializer === null) return;
    if (this.functionDepth > 0) return;
    if (ExpressionShape.isStringLiteral(initializer)) return;
    this.report(
      expression,
      "E0863",
      `A string at file scope may only be initialized by a literal, not '${initializer.written}'`,
      "Copying, concatenating and extracting a substring all need runtime calls, which C cannot make before `main`. Move the declaration into a function, or initialize it empty and assign later.",
    );
  };

  /** A string with no capacity: only a const one, from a literal */
  private checkInferred(
    stringCtx: Parser.StringTypeContext,
    isArray: boolean,
    isReadOnly: boolean,
    expression: Parser.ExpressionContext | null,
    initializer: TExpression | null,
  ): void {
    if (isArray) {
      this.report(
        stringCtx,
        "E0862",
        "A string array requires an explicit capacity",
        "Write the element capacity, e.g. string<64>[4].",
      );
      return;
    }
    if (!isReadOnly) {
      this.report(
        stringCtx,
        "E0862",
        "A `mut` string requires an explicit capacity",
        "Write the capacity, e.g. string<64>. Only a read-only string can have one inferred.",
      );
      return;
    }
    if (expression === null || initializer === null) {
      this.report(
        stringCtx,
        "E0862",
        "A read-only string without a capacity requires an initializer to infer it from",
        "Write the capacity, e.g. string<64>, or initialize it with a literal.",
      );
      return;
    }
    if (!ExpressionShape.isStringLiteral(initializer)) {
      this.report(
        expression,
        "E0862",
        "A read-only string without a capacity requires a string literal to infer it from",
        "Write the capacity, e.g. string<64>. A capacity can only be inferred from a literal.",
      );
    }
  }

  private report(
    at: ParserRuleContext,
    code: string,
    message: string,
    helpText: string,
  ): void {
    const position = ParserUtils.getPosition(at);
    this.found.push({
      line: position.line,
      column: position.column,
      message: CodedErrorText.of(code, message),
      helpText,
      severity: "error",
    });
  }
}

class StringForm {
  /** Every string-declaration form error in a tree that parsed */
  static errorsIn(tree: Parser.ProgramContext): ITranspileError[] {
    const listener = new StringFormListener();
    ParseTreeWalker.DEFAULT.walk(listener, tree);
    return listener.errors();
  }
}

export default StringForm;
