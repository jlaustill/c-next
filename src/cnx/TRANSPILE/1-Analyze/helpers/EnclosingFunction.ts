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

import * as Parser from "../../../PARSE/2-Parse/grammar/CNextParser";

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
}

export default EnclosingFunction;
