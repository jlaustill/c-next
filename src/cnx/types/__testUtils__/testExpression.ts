import type TExpression from "../syntax/TExpression";
import TestSourceSpan from "./testSourceSpan";

/** A plain-data expression as 1.2 lowers it, for hand-built symbols */
class TestExpression {
  static hex(text: string): TExpression {
    return {
      kind: "literal",
      literalKind: "hex",
      text,
      span: TestSourceSpan.at(1),
      written: text,
    };
  }
}

export default TestExpression;
