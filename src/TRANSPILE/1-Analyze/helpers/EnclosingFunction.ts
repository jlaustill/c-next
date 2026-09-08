/**
 * The function a node sits in, and what its parameters say.
 *
 * #1322: two rules need "is this name a parameter of the function I am in?",
 * and they need different answers from it. ADR-013 asks so E0877 can say
 * "parameter" rather than "variable"; ADR-023 asks because `sizeof` on an
 * array PARAMETER returns a pointer's size, while `sizeof` on a local array
 * returns the array's -- the same spelling, opposite answers, and the
 * difference is exactly whether it is a parameter.
 *
 * Returning the parameter itself rather than a boolean is what lets one
 * lookup serve both: a caller that only needs to know THAT it is a parameter
 * checks for null, and a caller that needs to know what KIND reads it.
 */

import { ParserRuleContext } from "antlr4ng";

import * as Parser from "../../../transpiler/logic/parser/grammar/CNextParser";

class EnclosingFunction {
  /** The nearest enclosing function declaration, or null at file scope. */
  static of(at: ParserRuleContext): Parser.FunctionDeclarationContext | null {
    let cursor: ParserRuleContext | null = at.parent;
    while (cursor) {
      if (cursor instanceof Parser.FunctionDeclarationContext) return cursor;
      cursor = cursor.parent;
    }
    return null;
  }

  /** The enclosing function's parameter of this name, or null. */
  static parameterOf(
    name: string,
    at: ParserRuleContext,
  ): Parser.ParameterContext | null {
    const fn = EnclosingFunction.of(at);
    return (
      fn
        ?.parameterList()
        ?.parameter()
        .find((p) => p.IDENTIFIER().getText() === name) ?? null
    );
  }

  /**
   * Whether a parameter is declared as an array.
   *
   * Only the PREFIX form `u8[4] data`, which is the one ADR-036 allows. The
   * grammar still parses the trailing form `u8 data[4]`, and a second arm here
   * accepted it -- but E0874 rejects that spelling for every parameter and
   * runs first, so the arm could not fire for any program and reddened no
   * fixture when removed. Dead code that reads as a rule is worse than absent:
   * it says the trailing form is handled here, and the reason it never arrives
   * is somewhere else entirely.
   */
  static isArrayParameter(parameter: Parser.ParameterContext): boolean {
    return parameter.type().arrayType() !== null;
  }
}

export default EnclosingFunction;
