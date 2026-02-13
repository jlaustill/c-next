/**
 * Callbacks required for argument generation.
 * These need CodeGenerator context and cannot be replaced with static state.
 *
 * Issue #794: Extracted from CodeGenerator to reduce file size.
 */

import * as Parser from "../../../../logic/parser/grammar/CNextParser.js";

interface IArgumentGeneratorCallbacks {
  /** Determine if expression is an lvalue (member access or array access) */
  getLvalueType: (ctx: Parser.ExpressionContext) => "member" | "array" | null;

  /** Check if member access is to an array field */
  getMemberAccessArrayStatus: (
    ctx: Parser.ExpressionContext,
  ) => "array" | "not-array" | "unknown";

  /** Check if C++ mode needs temp variable for type conversion */
  needsCppMemberConversion: (
    ctx: Parser.ExpressionContext,
    targetType?: string,
  ) => boolean;

  /** Check if expression is subscript access on a string variable */
  isStringSubscriptAccess: (ctx: Parser.ExpressionContext) => boolean;

  /** Generate expression code */
  generateExpression: (ctx: Parser.ExpressionContext) => string;
}

export default IArgumentGeneratorCallbacks;
