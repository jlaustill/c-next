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

/** The initializer of `r`, and the context that types it */
function initializerOf(source: string) {
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
  return { expression: found!, context };
}

/** ADR-044's behavior for the initializer of `r` */
function overflowOf(source: string): string | null {
  const { expression, context } = initializerOf(source);
  return PlanTyping.overflowOf(OperandTyper.valueLeaves(expression, context));
}

describe("PlanTyping.directTypeName", () => {
  const globals = "u16 a <- 1;\nu16 b <- 2;\nu8 half() {\nreturn 1;\n}\n";
  const directTypeOf = (body: string): string | null => {
    const { expression, context } = initializerOf(
      `${globals}void main() {\n${body}\n}`,
    );
    return PlanTyping.directTypeName(OperandTyper.typeOf(expression, context));
  };

  it.each([
    ["a composite has no one type", "u16 r <- a + b;", null],
    ["nor a parenthesized one", "u16 r <- (a + b);", null],
    ["nor a ternary", "u16 r <- (a > b) ? a : b;", null],
    ["a comparison is bool", "bool r <- a < b;", "bool"],
    ["an unsuffixed literal is int", "u16 r <- 5;", "int"],
    ["a variable is its declared type", "u16 r <- a;", "u16"],
    // #1668 S21: ETR could not type a call, so a slice treated one as a
    // composite and bound it to a temp, and a C++ enum field of a call's
    // result lost the #304 cast its variable spelling had
    ["a call is its return type", "u8 r <- half();", "u8"],
  ])("%s", (_why, body, expected) => {
    expect(directTypeOf(body)).toBe(expected);
  });
});

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
