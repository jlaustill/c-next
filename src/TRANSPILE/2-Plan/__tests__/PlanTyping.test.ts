/**
 * #1668: PlanTyping's rows over the one operand typer's facts, each asserted
 * on a real declared and resolved program.
 */
import { describe, expect, it } from "vitest";
import { ParseTreeWalker } from "antlr4ng";
import { CNextListener } from "../../../PARSE/2-Parse/grammar/CNextListener";
import * as Parser from "../../../PARSE/2-Parse/grammar/CNextParser";
import OperandTyper from "../../../utils/OperandTyper";
import PlanTyping from "../PlanTyping";
import testAnalysisContextFor from "../../1-Analyze/__tests__/testAnalysisContextFor";

/** ADR-044's behavior for the initializer of `r` */
function overflowOf(source: string): string | null {
  const { tree, context } = testAnalysisContextFor(source);
  let found: Parser.ExpressionContext | null = null;
  ParseTreeWalker.DEFAULT.walk(
    new (class extends CNextListener {
      override enterVariableDeclaration = (
        ctx: Parser.VariableDeclarationContext,
      ): void => {
        if (ctx.IDENTIFIER().getText() === "r") found = ctx.expression();
      };
    })(),
    tree,
  );
  expect(found).not.toBeNull();
  return PlanTyping.overflowOf(OperandTyper.valueLeaves(found!, context));
}

describe("PlanTyping.overflowOf (ADR-044)", () => {
  const globals = "wrap u32 w <- 1;\nclamp u32 c <- 1;\nu32[2] arr;\n";

  it.each([
    ["clamp wins a mix", "u32 r <- w + c;", "clamp"],
    ["every counted leaf wraps", "u32 r <- w + w;", "wrap"],
    [
      "a declaration with no modifier clamps",
      "u32 x <- 1;\nu32 r <- x + 1;",
      "clamp",
    ],
    ["an element is not counted", "u32 r <- arr[0] + 1;", null],
    ["a literal is not counted", "u32 r <- 1 + 2;", null],
  ])("%s", (_why, body, expected) => {
    expect(overflowOf(`${globals}void main() {\n${body}\n}`)).toBe(expected);
  });

  it("counts a parameter with no behavior of its own, as wrap (#1681)", () => {
    expect(
      overflowOf("void f(u32 p) {\nu32 r <- p + 1;\n}\nvoid main() {\n}"),
    ).toBe("wrap");
  });

  it("does not count a `for` variable (#1667)", () => {
    expect(
      overflowOf(
        "void main() {\nfor (u32 i <- 0; i < 3; i +<- 1) {\nu32 r <- i + 1;\n}\n}",
      ),
    ).toBe(null);
  });
});
