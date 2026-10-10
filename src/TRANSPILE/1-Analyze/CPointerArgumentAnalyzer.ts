/**
 * A C function's pointer parameter takes an object of the type it points to:
 * E0895.
 *
 * #1977, owner ruling: a struct handed to a C function's `const uint8_t*` is a
 * compile error. The C was `send_u8(&r, 12U)` -- exit 0, and an
 * incompatible-pointer conversion gcc 14 rejects -- with a byte count nobody
 * checks against the object. A `u32` handed to the same parameter was passed
 * as `w`, a pointer made from an integer. One rule covers both: the argument's
 * C type is the pointee's, or the parameter is `void*`.
 *
 * Asked only where both sides are known: a C function (a C-Next function's
 * parameters are C-Next's own), a parameter of exactly one pointer, and an
 * argument the typer types as a declared value. A literal or an expression is
 * passed as a compound literal of the parameter's type.
 */

import { ParserRuleContext, ParseTreeWalker } from "antlr4ng";

import { CNextListener } from "../../PARSE/2-Parse/grammar/CNextListener";
import * as Parser from "../../PARSE/2-Parse/grammar/CNextParser";
import SyntaxLowering from "../../PARSE/2-Parse/SyntaxLowering";
import ParserUtils from "../../utils/ParserUtils";
import OperandTyper from "../../utils/OperandTyper";
import CNEXT_TO_C_TYPE_MAP from "../../utils/constants/TypeMappings";
import type IOperandType from "../../types/IOperandType";
import type ICParameterInfo from "../../types/symbols/c/ICParameterInfo";
import type IBaseAnalysisError from "./types/IBaseAnalysisError";
import type IAnalysisContext from "./types/IAnalysisContext";

class CPointerArgumentListener extends CNextListener {
  private readonly found: IBaseAnalysisError[] = [];

  public constructor(private readonly context: IAnalysisContext) {
    super();
  }

  public errors(): IBaseAnalysisError[] {
    return this.found;
  }

  override enterPostfixExpression = (
    ctx: Parser.PostfixExpressionContext,
  ): void => {
    const ops = ctx.postfixOp();
    if (ops.length !== 1 || ops[0].LPAREN() === null) return;
    const name = ctx.primaryExpression()?.IDENTIFIER()?.getText();
    if (name === undefined) return;
    const parameters = this.cParameters(name);
    if (parameters === null) return;
    const args = ops[0].argumentList()?.expression() ?? [];
    args.forEach((arg, index) => {
      const pointee = CPointerArgumentAnalyzer.pointee(parameters[index]?.type);
      if (pointee === null || pointee === "void") return;
      const argType = CPointerArgumentAnalyzer.cTypeOf(
        OperandTyper.typeOf(SyntaxLowering.expression(arg), this.context),
      );
      if (argType === null || argType === pointee) return;
      this.report(
        arg,
        `'${arg.getText()}' is ${argType}, and parameter ${index + 1} of '${name}' points to ${pointee}`,
        `A C pointer parameter takes an object of the type it points to; pass a ${pointee}, or an array of them.`,
      );
    });
  };

  /** A C function's parameters, or null when the name calls something else */
  private cParameters(name: string): ReadonlyArray<ICParameterInfo> | null {
    if (this.context.program.symbolByCName(name)?.kind === "function") {
      return null;
    }
    for (const symbol of this.context.symbolTable.getCOverloads(name)) {
      if (symbol.kind === "function" && symbol.parameters) {
        return symbol.parameters;
      }
    }
    return null;
  }

  private report(at: ParserRuleContext, message: string, helpText: string) {
    const { line, column } = ParserUtils.getPosition(at);
    this.found.push({ code: "E0895", line, column, message, helpText });
  }
}

class CPointerArgumentAnalyzer {
  constructor(private readonly context: IAnalysisContext) {}

  public analyze(tree: Parser.ProgramContext): IBaseAnalysisError[] {
    const listener = new CPointerArgumentListener(this.context);
    ParseTreeWalker.DEFAULT.walk(listener, tree);
    return listener.errors();
  }

  /**
   * What a parameter of exactly one pointer points to, without qualifiers:
   * `const uint8_t*` is `uint8_t`. Null for anything else.
   */
  static pointee(type: string | undefined): string | null {
    const trimmed = type?.trim() ?? "";
    const star = trimmed.indexOf("*");
    if (star < 0 || star !== trimmed.length - 1) return null;
    return trimmed
      .slice(0, star)
      .split(/\s+/)
      .filter((word) => word !== "" && word !== "const" && word !== "volatile")
      .join(" ");
  }

  /** A declared value's C type -- an array's is its element's -- or null */
  static cTypeOf(typed: IOperandType | null): string | null {
    if (typed?.form.kind !== "declared" || typed.typeName === null) {
      return null;
    }
    if (typed.stringCapacity !== null) return "char";
    return CNEXT_TO_C_TYPE_MAP[typed.typeName] ?? typed.typeName;
  }
}

export default CPointerArgumentAnalyzer;
