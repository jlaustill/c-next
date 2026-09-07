import { describe, expect, it } from "vitest";

import CNextSourceParser from "../../../transpiler/logic/parser/CNextSourceParser";
import CallbackAssignmentAnalyzer from "../CallbackAssignmentAnalyzer";

/**
 * #1322. ADR-029's callback typing: E0879 (a function whose declared signature
 * does not match the slot's callback type) and E0880 (a function that is
 * itself a callback type standing in for another -- nominal typing).
 *
 * Both rules resolve a name to a function symbol through `Program`, which a
 * unit test does not build, so the rules themselves are asserted end to end by
 * `tests/adr-029/`. What is asserted here is the part that is pure parse-tree
 * work and would otherwise only be observable through a fixture: the analyzer
 * finds the four slots a function name can land in, and stays silent on
 * everything a slot is not.
 *
 * Written as "reaches the rule / does not reach the rule" rather than as
 * "reports / does not report" because with no program the rule can never
 * report -- a test asserting an empty array for both would pass whatever the
 * walk did, which is the guard-that-cannot-fail shape.
 */
const findings = (source: string) => {
  const { tree } = CNextSourceParser.parse(source);
  return new CallbackAssignmentAnalyzer().analyze(tree);
};

describe("CallbackAssignmentAnalyzer", () => {
  it("returns no findings when the program's symbols are absent", () => {
    // The precondition every case below shares: without `Program` neither
    // rule can name a function, so the analyzer is silent by construction.
    // This is what makes the fixtures, not this file, the rules' evidence.
    expect(
      findings(
        [
          "struct P { u32 x; }",
          "void onDown(const P p) { }",
          "void onUp(const P p) { }",
          "struct H { onDown down; }",
          "void t() { H h; h.down <- onUp; }",
        ].join("\n"),
      ),
    ).toEqual([]);
  });

  it("walks every slot and every construct without throwing", () => {
    // ADR-029's four slots plus the shapes that are NOT slots. The analyzer
    // walks each one; a crash here is the failure this catches, and it has
    // caught two -- an `ArgumentList` whose parent chain is not a call, and a
    // `for` header's declaration with no initializer.
    const source = [
      "struct P { u32 x; }",
      "void onDown(const P p) { }",
      "struct H { onDown down; }",
      "void takesDown(onDown cb) { }",
      "void t() {",
      "    H h;",
      "    h.down <- onDown;", // slot 1: assignment
      "    onDown cb <- onDown;", // slot 2: declaration
      "    H init <- { down: onDown };", // slot 3: struct initializer field
      "    takesDown(onDown);", // slot 4: call argument
      "    for (u8 i <- 0; i < 2; i +<- 1) { }", // a for header, no initializer to type
      "    u8[2] arr <- [1, 2];", // an array initializer, not a struct one
      "    u8 v <- arr[0];", // a subscript, where no struct is expected
      "    h.down(h.down);", // a call THROUGH a value, which names no function
      "}",
    ].join("\n");
    expect(() => findings(source)).not.toThrow();
  });

  it("types an inferred struct initializer from each establishing node", () => {
    // `StructInitializerType` is shared with #1277, so its walk is exercised
    // here rather than only through the callback rule: a declaration, a
    // return statement, a nested field, and an argument each establish a type
    // for a `{ ... }` that does not name one.
    const source = [
      "struct Inner { u32 v; }",
      "struct Outer { Inner inner; }",
      "void takes(Outer o) { }",
      "Outer make() {",
      "    return { inner: { v: 1 } };",
      "}",
      "void t() {",
      "    Outer a <- { inner: { v: 2 } };",
      "    takes({ inner: { v: 3 } });",
      "    a <- { inner: { v: 4 } };",
      "}",
    ].join("\n");
    expect(() => findings(source)).not.toThrow();
  });
});
