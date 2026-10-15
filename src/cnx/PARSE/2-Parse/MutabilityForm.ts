/**
 * ADR-071: every binding is read-only unless declared `mut`, so a written
 * `const` says nothing and is E0898. It reads only how a declaration is
 * written, so 1.2 reports it.
 */
import { ParseTreeWalker } from "antlr4ng";
import { CNextListener } from "./grammar/CNextListener";
import * as Parser from "./grammar/CNextParser";
import ParserUtils from "../../utils/ParserUtils";
import CodedErrorText from "../../utils/CodedErrorText";
import type ITranspileError from "../../types/ITranspileError";

class MutabilityFormListener extends CNextListener {
  private readonly found: ITranspileError[] = [];

  public errors(): ITranspileError[] {
    return this.found;
  }

  override enterConstModifier = (ctx: Parser.ConstModifierContext): void => {
    const position = ParserUtils.getPosition(ctx);
    this.found.push({
      line: position.line,
      column: position.column,
      message: CodedErrorText.of("E0898", "`const` is the default; remove it"),
      helpText:
        "Every binding is read-only unless declared `mut` (ADR-071); delete `const`.",
      severity: "error",
    });
  };
}

class MutabilityForm {
  /** Every `const` written on a declaration in a tree that parsed */
  static errorsIn(tree: Parser.ProgramContext): ITranspileError[] {
    const listener = new MutabilityFormListener();
    ParseTreeWalker.DEFAULT.walk(listener, tree);
    return listener.errors();
  }
}

export default MutabilityForm;
