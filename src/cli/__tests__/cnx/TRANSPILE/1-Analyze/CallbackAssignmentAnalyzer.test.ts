import { describe, expect, it } from "vitest";

import CnxSourceParser from "../../../../../cnx/PARSE/2-Parse/CnxSourceParser";
import CallbackAssignmentAnalyzer from "../../../../../cnx/TRANSPILE/1-Analyze/CallbackAssignmentAnalyzer";
import ValuePositions from "../../../../../cnx/TRANSPILE/1-Analyze/helpers/ValuePositions";
import TranspileState from "../../../../../cnx/TRANSPILE/TranspileState";
import testAnalysisContext from "../../../../../cnx/TRANSPILE/1-Analyze/__tests__/testAnalysisContext";
import SymbolTable from "../../../../../cnx/PARSE/3-Declare/SymbolTable";
import type ICParameterInfo from "../../../../../cnx/types/symbols/c/ICParameterInfo";
import ESourceLanguage from "../../../../../cnx/utils/types/ESourceLanguage";
import TestSourceSpan from "../../../../../cnx/types/__testUtils__/testSourceSpan";
import testAnalysisContextFor from "./testAnalysisContextFor";

/**
 * #1322. ADR-029's callback typing: E0879 (a function whose declared signature
 * does not match the slot's callback type) and E0880 (a function that is
 * itself a callback type standing in for another -- nominal typing).
 *
 * Both rules resolve a name to a function symbol through `Program`, so every
 * case but the first runs against a real, declared and resolved one (#1668,
 * `testAnalysisContextFor`); `tests/adr-029/` asserts the rules end to end.
 * The walk cases assert "does not throw" over the four slots a function name
 * can land in and the shapes that are not slots.
 *
 * The first case keeps an EMPTY program on purpose. It used to assert that
 * with nothing declared neither rule can report; since the analyzer asks
 * Program where each node sits (#1668), an empty program is refused loudly
 * instead, which is the better answer to a caller error than silence.
 *
 * #1322 review: the `with a program behind it` block below asserts the two
 * rules actually fire, with a control beside each.
 */
const build = (source: string) => {
  const { syntax, context } = testAnalysisContextFor(source, {
    cppMode: false,
  });
  return new CallbackAssignmentAnalyzer(context).analyze(
    syntax,
    ValuePositions.of(syntax, context).positions,
  );
};

// Only the empty-program case below: it asserts what an EMPTY program does,
// which a real declared program cannot stand in for.
const findings = (source: string) => {
  const syntax = CnxSourceParser.parse(source).program;
  return new CallbackAssignmentAnalyzer(
    testAnalysisContext(new TranspileState()),
  ).analyze(syntax, new Map());
};

describe("CallbackAssignmentAnalyzer", () => {
  // Same as `FunctionReference`: the context always carries a program, so
  // "absent" is unrepresentable. What this checks is an empty one: a program
  // that does not hold the file is a caller error (#1668), refused rather than
  // answered "nothing is declared", which is how this case used to pass.
  it("refuses a program that does not hold the file", () => {
    expect(() =>
      findings(
        [
          "struct P { u32 x; }",
          "void onDown(P p) { }",
          "void onUp(P p) { }",
          "struct H { onDown down; }",
          "void t() { H h; h.down <- onUp; }",
        ].join("\n"),
      ),
    ).toThrow("is a file of this program");
  });

  it("walks every slot and every construct without throwing", () => {
    // ADR-029's four slots plus the shapes that are NOT slots. The analyzer
    // walks each one; a crash here is the failure this catches, and it has
    // caught two -- an `ArgumentList` whose parent chain is not a call, and a
    // `for` header's declaration with no initializer.
    const source = [
      "struct P { u32 x; }",
      "void onDown(P p) { }",
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
    expect(() => build(source)).not.toThrow();
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
    expect(() => build(source)).not.toThrow();
  });
  describe("with a program behind it, the rules fire", () => {
    // ADR-029 compares DECLARED signatures. The types below differ only in the
    // one thing each case is about, so a rule that compared something else
    // would not report where these expect it to.
    const preamble = [
      "struct P { u32 x; }",
      "void onDown(P p) { }",
      "void matching(P p) { }",
      "void wrongConst(mut P p) { }",
      "struct H { onDown down; }",
      "void takesDown(onDown cb) { }",
    ].join("\n");

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
          "    h <- { down: wrongConst };", // initializer typed by its target
          "}",
        ].join("\n"),
      );
      expect(found.map((e) => e.code)).toEqual([
        "E0879",
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
            "    h <- { down: matching };",
            "}",
          ].join("\n"),
        ),
      ).toEqual([]);
    });

    it("resolves a callback type and a function declared in a scope", () => {
      // Both names are looked up from the scope the slot sits in (#1668:
      // Program's lexical frame), not from file scope
      const scoped = (value: string) =>
        build(
          [
            "struct P { u32 x; }",
            "scope Motor {",
            "    public void onStop(P p) { }",
            "    void matchingStop(P p) { }",
            "    void wrongStop(mut P p) { }",
            `    public void f() { onStop cb <- ${value}; }`,
            "}",
          ].join("\n"),
        ).map((e) => e.code);
      expect(scoped("wrongStop")).toEqual(["E0879"]);
      expect(scoped("matchingStop")).toEqual([]);
    });

    it("reports E0880 for a function that is itself a field type", () => {
      // Nominal typing: `other` is `G`'s field type, so it is its own callback
      // type and cannot stand in for `onDown` even with a matching signature.
      const found = build(
        [
          preamble,
          "void other(P p) { }",
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

    it("names a `this.` target as the variable it is (#1991)", () => {
      const found = build(
        [
          preamble,
          "void other(P p) { }",
          "struct G { other cb; }",
          "scope S {",
          "    onDown handler;",
          "    void t() { this.handler <- other; }",
          "}",
        ].join("\n"),
      );
      expect(found.map((e) => e.code)).toEqual(["E0880"]);
      expect(found[0].message).toContain("callback variable 'this.handler'");
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

/**
 * #1619: a function a C header declares is held to the slot's signature by C
 * type identity under the header compiler, which names the C type of each
 * `<stdint.h>` name (`__UINT32_TYPE__`).
 */
describe("CallbackAssignmentAnalyzer with a function a C header declares", () => {
  const ARM = { uint32_t: "long unsigned int", uint8_t: "unsigned char" };
  const X86_64 = { uint32_t: "unsigned int", uint8_t: "unsigned char" };

  const declare = (
    symbolTable: SymbolTable,
    name: string,
    type: string,
    parameters: ICParameterInfo[] = [],
    isVariadic = false,
  ): void => {
    symbolTable.addCSymbol({
      name,
      kind: "function",
      sourceLanguage: ESourceLanguage.C,
      sourceFile: "clock.h",
      span: TestSourceSpan.at(1),
      visibility: "public",
      type,
      parameters: parameters.length > 0 ? parameters : undefined,
      isVariadic: isVariadic || undefined,
      isDeclaration: true,
    });
  };

  const run = (
    value: string,
    integerTypes: Record<string, string>,
    cppMode = false,
  ): string[] => {
    const symbolTable = new SymbolTable();
    declare(symbolTable, "millis", "unsigned long");
    declare(symbolTable, "spelled", "long unsigned int");
    declare(symbolTable, "clock32", "unsigned int");
    declare(symbolTable, "stdintClock", "uint32_t");
    declare(symbolTable, "logf", "uint32_t", [], true);
    declare(symbolTable, "onByte", "void", [
      { name: "b", type: "uint8_t", isConst: false, isArray: false },
    ]);
    declare(symbolTable, "onBytePtr", "void", [
      { name: "b", type: "uint8_t *", isConst: false, isArray: false },
    ]);
    const { syntax, context } = testAnalysisContextFor(
      [
        "u32 tickSource() { return 0; }",
        "void byteSink(u8 b) { (void) b; }",
        "void byteOut(mut u8 b) { b <- 1; }",
        "struct T { tickSource tick; byteSink sink; byteOut out; }",
        `T t <- { ${value} };`,
      ].join("\n"),
      { symbolTable, integerTypes, cppMode },
    );
    return new CallbackAssignmentAnalyzer(context)
      .analyze(syntax, ValuePositions.of(syntax, context).positions)
      .map((e) => `${e.code} ${e.message}`);
  };

  it("accepts unsigned long where uint32_t is unsigned long", () => {
    expect(run("tick: millis", ARM)).toEqual([]);
    expect(run("tick: spelled", ARM)).toEqual([]);
    expect(run("tick: stdintClock", ARM)).toEqual([]);
  });

  it("rejects unsigned int there, though it is 32 bits too", () => {
    expect(run("tick: clock32", ARM)).toEqual([
      "E0879 Function 'clock32' signature does not match callback type 'tickSource'",
    ]);
  });

  it("follows the compiler, not the spelling, on another target", () => {
    expect(run("tick: clock32", X86_64)).toEqual([]);
    expect(run("tick: millis", X86_64)).toEqual([
      "E0879 Function 'millis' signature does not match callback type 'tickSource'",
    ]);
  });

  it("rejects a variadic function, though it takes no named parameter", () => {
    expect(run("tick: logf", ARM)).toEqual([
      "E0879 Function 'logf' signature does not match callback type 'tickSource'",
    ]);
  });

  it("compares a parameter as the callback typedef writes it", () => {
    expect(run("sink: onByte", ARM)).toEqual([]);
    expect(run("out: onBytePtr", ARM)).toEqual([]);
    expect(run("sink: onBytePtr", ARM)).toEqual([
      "E0879 Function 'onBytePtr' signature does not match callback type 'byteSink'",
    ]);
    expect(run("out: onByte", ARM)).toEqual([
      "E0879 Function 'onByte' signature does not match callback type 'byteOut'",
    ]);
  });

  it("takes a mut scalar as a reference in C++", () => {
    expect(run("out: onBytePtr", ARM, true)).toEqual([
      "E0879 Function 'onBytePtr' signature does not match callback type 'byteOut'",
    ]);
  });
});
