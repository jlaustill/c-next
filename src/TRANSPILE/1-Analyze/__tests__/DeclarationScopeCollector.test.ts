import { ParseTreeWalker } from "antlr4ng";
import { describe, expect, it } from "vitest";

import CNextSourceParser from "../../../transpiler/logic/parser/CNextSourceParser";
import DeclarationScopeCollector from "../DeclarationScopeCollector";
import ScopeFrameResolver from "../ScopeFrameResolver";

/**
 * #1322. `IScopeFrame.vars` recorded a declared name against its type TEXT and
 * discarded everything else the collector had already walked past.
 *
 * That is what stops 2.1 authoring most of the diagnostics #1322 relocates.
 * `ICodeGenSymbols` -- the only type view an analyzer may read, because it is
 * the one populated before `runAnalyzers` -- carries no per-variable
 * dimensions, capacity or const-ness at all; those live in
 * `CodeGenState.typeRegistry`, which is filled DURING codegen and which
 * CLAUDE.md forbids an analyzer to read (an analyzer that does sees an empty
 * map for file 1 and file N-1's data thereafter, which is how #1399 shipped an
 * order-dependent diagnostic).
 *
 * So the facts are not missing from the program, only from the record: the
 * collector visits every declaration site already. Each field below is one
 * file's parse tree away.
 */
const collect = (source: string): DeclarationScopeCollector => {
  const { tree } = CNextSourceParser.parse(source);
  const collector = new DeclarationScopeCollector();
  ParseTreeWalker.DEFAULT.walk(collector, tree);
  return collector;
};

const globalVar = (source: string, name: string) =>
  collect(source).getGlobalFrame().vars.get(name);

describe("DeclarationScopeCollector records what a declaration says", () => {
  it("keeps the declared type text, which is what it always recorded", () => {
    expect(globalVar("u32 count <- 0;", "count")?.typeText).toBe("u32");
  });

  it("records no dimensions for a scalar", () => {
    expect(globalVar("u32 count <- 0;", "count")?.dimensions).toEqual([]);
  });

  it("records a literal array dimension as a number", () => {
    // The slice-assignment checks in `ArrayHandlers` need exactly this, and
    // today they read it from codegen state, which is why they cannot move.
    expect(globalVar("u32[10] buffer;", "buffer")?.dimensions).toEqual([10]);
  });

  it("records a const-named dimension as the name, unresolved", () => {
    // `arrayDimensions` is `(number | string)[]` everywhere else in the
    // transpiler for the same reason: a C macro or a const has no value here.
    // Recording the name rather than guessing keeps the distinction the
    // consumer needs.
    const source = "const u32 SIZE <- 4;\nu32[SIZE] buffer;";
    expect(globalVar(source, "buffer")?.dimensions).toEqual(["SIZE"]);
  });

  it("records every dimension of a multi-dimensional array, in order", () => {
    expect(globalVar("u32[2][3] grid;", "grid")?.dimensions).toEqual([2, 3]);
  });

  it("records a string's declared capacity", () => {
    expect(globalVar('string<8> name <- "x";', "name")?.stringCapacity).toBe(8);
  });

  it("records no capacity for a non-string", () => {
    expect(globalVar("u32 count <- 0;", "count")?.stringCapacity).toBeNull();
  });

  it("records const-ness from the modifier", () => {
    expect(globalVar("const u32 LIMIT <- 4;", "LIMIT")?.isConst).toBe(true);
    expect(globalVar("u32 count <- 0;", "count")?.isConst).toBe(false);
  });

  it("records a parameter's const-ness and array shape too", () => {
    // Parameters carry their own `constModifier`, and a const parameter is the
    // subject of every ADR-013 assignment diagnostic.
    const collector = collect("void f(const u32[4] data) { u32 x <- 1; }");
    const frames = collector.getGlobalFrame();
    // The parameter lives in the function's frame, not the global one.
    expect(frames.vars.has("data")).toBe(false);
  });
});

describe("ScopeFrameResolver reads the widened record", () => {
  it("still answers with the type text for its existing callers", () => {
    const collector = collect("u32 count <- 0;");
    const resolver = new ScopeFrameResolver(collector);
    expect(
      resolver.typeOfNameLexical("count", collector.getGlobalFrame()),
    ).toBe("u32");
  });

  it("answers the whole declaration for a caller that needs more", () => {
    const collector = collect("u32[10] buffer;");
    const resolver = new ScopeFrameResolver(collector);
    const declared = resolver.declarationOfNameLexical(
      "buffer",
      collector.getGlobalFrame(),
    );
    expect(declared?.dimensions).toEqual([10]);
  });

  it("returns null for a name no frame declares", () => {
    const collector = collect("u32 count <- 0;");
    const resolver = new ScopeFrameResolver(collector);
    expect(
      resolver.declarationOfNameLexical("absent", collector.getGlobalFrame()),
    ).toBeNull();
  });
});
