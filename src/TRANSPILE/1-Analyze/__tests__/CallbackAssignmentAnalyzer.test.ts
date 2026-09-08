import { describe, expect, it } from "vitest";

import CNextSourceParser from "../../../transpiler/logic/parser/CNextSourceParser";
import CallbackAssignmentAnalyzer from "../CallbackAssignmentAnalyzer";
import CNextResolver from "../../../PARSE/3-Declare/cnext";
import CodeGenState from "../../../transpiler/state/CodeGenState";
import Program from "../../../PARSE/4-Resolve/Program";
import SymbolRegistry from "../../../transpiler/state/SymbolRegistry";
import TSymbolInfoAdapter from "../../../PARSE/3-Declare/cnext/adapters/TSymbolInfoAdapter";

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
 *
 * #1322 review: the `with a program behind it` block below builds a real
 * `Program` so the two rules actually fire. Without it neither reporting path
 * ran here at all -- the walk was covered and the decisions were not, which is
 * the same distinction the paragraph above draws and the reason the fixtures
 * were carrying the whole rule.
 */
const build = (source: string) => {
  SymbolRegistry.reset();
  const { tree } = CNextSourceParser.parse(source);
  CodeGenState.program = Program.build([CNextResolver.resolve(tree, "a.cnx")]);
  CodeGenState.symbols = TSymbolInfoAdapter.convert(
    CNextResolver.resolve(tree, "a.cnx").symbols,
  );
  return new CallbackAssignmentAnalyzer().analyze(tree);
};

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
  describe("with a program behind it, the rules fire", () => {
    // ADR-029 compares DECLARED signatures. The types below differ only in the
    // one thing each case is about, so a rule that compared something else
    // would not report where these expect it to.
    const preamble = [
      "struct P { u32 x; }",
      "void onDown(const P p) { }",
      "void matching(const P p) { }",
      "void wrongConst(P p) { }",
      "struct H { onDown down; }",
      "void takesDown(onDown cb) { }",
    ].join("\n");

    afterEach(() => {
      CodeGenState.reset();
    });

    it("reports E0879 when the declared signature differs, in each slot", () => {
      // One slot per line, so a dropped slot is a count change.
      const found = build(
        [
          preamble,
          "void t() {",
          "    H h;",
          "    h.down <- wrongConst;", // assignment target
          "    onDown cb <- wrongConst;", // declaration
          "    H init <- { down: wrongConst };", // struct-initializer field
          "    takesDown(wrongConst);", // call argument
          "}",
        ].join("\n"),
      );
      expect(found.map((e) => e.code)).toEqual([
        "E0879",
        "E0879",
        "E0879",
        "E0879",
      ]);
      expect(found[0].message).toContain("does not match callback type");
      expect(found[0].column).toBeGreaterThan(0);
    });

    it("accepts a function whose declared signature matches exactly", () => {
      // The control for E0879: same shape, same slots, a matching signature.
      expect(
        build(
          [
            preamble,
            "void t() {",
            "    H h;",
            "    h.down <- matching;",
            "    onDown cb <- matching;",
            "    H init <- { down: matching };",
            "    takesDown(matching);",
            "}",
          ].join("\n"),
        ),
      ).toEqual([]);
    });

    it("reports E0880 for a function that is itself a field type", () => {
      // Nominal typing: `other` is `G`'s field type, so it is its own callback
      // type and cannot stand in for `onDown` even with a matching signature.
      const found = build(
        [
          preamble,
          "void other(const P p) { }",
          "struct G { other cb; }",
          "void t() {",
          "    H h;",
          "    h.down <- other;",
          "}",
        ].join("\n"),
      );
      expect(found.map((e) => e.code)).toEqual(["E0880"]);
      expect(found[0].message).toContain("nominal typing");
    });

    it("accepts a matching function that is NOT a field type", () => {
      // The control for E0880, and the reason it is a separate rule from
      // E0879: `matching` has the identical signature to `other` above.
      expect(
        build(
          [
            preamble,
            "void t() {",
            "    H h;",
            "    h.down <- matching;",
            "}",
          ].join("\n"),
        ),
      ).toEqual([]);
    });

    it("stays silent where the slot's type is not a function", () => {
      expect(
        build(
          [
            preamble,
            "void t() {",
            "    u8 plain <- 1;",
            "    plain <- 2;",
            "}",
          ].join("\n"),
        ),
      ).toEqual([]);
    });
  });
});
