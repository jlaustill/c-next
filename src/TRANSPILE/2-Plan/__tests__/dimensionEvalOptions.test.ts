/**
 * Unit tests for dimensionEvalOptions
 * Issue #1127: one place binding the constant evaluator to live codegen state.
 * #1664 box 7: the const values are the ones visible where the dimension is
 * folded, as 1.4 settled them -- not one map the render walk writes.
 */

import { describe, it, expect } from "vitest";
import { ParseTreeWalker } from "antlr4ng";
import { CNextListener } from "../../../PARSE/2-Parse/grammar/CNextListener";
import * as Parser from "../../../PARSE/2-Parse/grammar/CNextParser";
import TranspileState from "../../TranspileState";
import dimensionEvalOptions from "../dimensionEvalOptions";
import ConstExprLowering from "../../../utils/ConstExprLowering";
import SyntaxLowering from "../../../PARSE/2-Parse/SyntaxLowering";
import testAnalysisContextFor from "../../1-Analyze/__tests__/testAnalysisContextFor";

/** The render state for `source`, and each array dimension as written */
function setUp(source: string): {
  state: TranspileState;
  arrays: Parser.ExpressionContext[];
} {
  const { tree, context } = testAnalysisContextFor(source, { cppMode: false });
  const state = new TranspileState();
  state.program = context.program;
  state.symbols = context.symbols;
  state.sourcePath = context.sourceFile;
  const arrays: Parser.ExpressionContext[] = [];
  ParseTreeWalker.DEFAULT.walk(
    new (class extends CNextListener {
      override enterArrayTypeDimension = (
        ctx: Parser.ArrayTypeDimensionContext,
      ): void => {
        const expression = ctx.expression();
        if (expression) arrays.push(expression);
      };
    })(),
    tree,
  );
  return { state, arrays };
}

const SHADOWED = `const u32 N <- 8;
u32 first() {
    const u32 N <- 2;
    u8[N] near;
    return N;
}
u32 second() {
    u8[N] far;
    return N;
}
u32 third() {
    u32 x <- 0;
    {
        const u32 N <- 3;
        x <- N;
    }
    u8[N] after;
    return x;
}`;

/** A dimension's value, by the one evaluator, in the state's environment */
function sizeOf(
  state: TranspileState,
  dimension: Parser.ExpressionContext,
): number | undefined {
  return ConstExprLowering.valueOf(
    SyntaxLowering.expression(dimension),
    dimensionEvalOptions(state),
  );
}

describe("dimensionEvalOptions", () => {
  it("folds sizeof through the shared TYPE_WIDTH table", () => {
    // Codegen and symbol collection must fold sizeof against the same widths;
    // supplying a different table is how the two layers came to disagree.
    const { state, arrays } = setUp("u8[sizeof(u32)] word;");
    expect(sizeOf(state, arrays[0])).toBe(4);
  });

  it("folds a local const where it is declared", () => {
    const { state, arrays } = setUp(SHADOWED);
    expect(sizeOf(state, arrays[0])).toBe(2);
  });

  it("does not carry a local const into another function", () => {
    // The render walk wrote `first`'s N into one map and never restored the
    // global's, so `second`'s `u8[N]` was sized 2
    const { state, arrays } = setUp(SHADOWED);
    expect(sizeOf(state, arrays[1])).toBe(8);
  });

  it("does not carry an inner block's const past the block", () => {
    const { state, arrays } = setUp(SHADOWED);
    expect(sizeOf(state, arrays[2])).toBe(8);
  });

  it("supplies exactly the lookups the evaluator consumes", () => {
    // An isKnownStruct predicate used to be threaded through here. It could
    // not change any answer, so callers that omitted it agreed only because
    // the difference was inert -- the latent divergence this helper exists to
    // prevent. It was removed rather than propagated. #1175: the evaluator
    // asks what a name is worth where it is written, and the printer how C
    // spells a type there (#1863 review), both of the program.
    const { state } = setUp(SHADOWED);
    expect(Object.keys(dimensionEvalOptions(state))).toEqual([
      "valueOf",
      "cTypeName",
    ]);
  });
});
