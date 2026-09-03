/**
 * Tests for HeaderEmissionPlanner
 * Issue #1323: the whole-program render step that turns every file's captured
 * IHeaderEmissionFacts into header text, reading no CodeGenState.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import HeaderEmissionPlanner from "../HeaderEmissionPlanner";
import HeaderGenerator from "../HeaderGenerator";
import IHeaderEmissionFacts from "../types/IHeaderEmissionFacts";
import IHeaderSymbol from "../types/IHeaderSymbol";
import IHeaderOptions from "../../codegen/types/IHeaderOptions";
import CodeGenState from "../../../state/CodeGenState";

describe("HeaderEmissionPlanner", () => {
  afterEach(() => {
    CodeGenState.reset();
  });

  function makeVarSymbol(name: string, type: string): IHeaderSymbol {
    return {
      name,
      type,
      kind: "variable",
      sourceFile: "test.cnx",
      sourceLine: 1,
    };
  }

  function makeFacts(
    filename: string,
    symbols: IHeaderSymbol[] = [makeVarSymbol("value", "u8")],
    options: IHeaderOptions = {},
  ): IHeaderEmissionFacts {
    return {
      symbols,
      filename,
      options,
      typeInput: undefined,
      passByValueParams: new Map(),
      allKnownEnums: new Set(),
      basename: filename,
    };
  }

  it("returns empty maps for an empty facts input", () => {
    const plan = HeaderEmissionPlanner.plan(new Map(), new HeaderGenerator());

    expect(plan.headersBySourcePath.size).toBe(0);
    expect(plan.errorsBySourcePath.size).toBe(0);
  });

  it("renders one file's header, keyed by source path", () => {
    const facts = new Map([["/src/foo.cnx", makeFacts("foo.h")]]);

    const plan = HeaderEmissionPlanner.plan(facts, new HeaderGenerator());

    expect(plan.headersBySourcePath.size).toBe(1);
    expect(plan.errorsBySourcePath.size).toBe(0);
    const header = plan.headersBySourcePath.get("/src/foo.cnx");
    expect(header).toContain("extern uint8_t value;");
  });

  it("renders every file independently, in one batch", () => {
    const facts = new Map([
      ["/src/foo.cnx", makeFacts("foo.h", [makeVarSymbol("a", "u8")])],
      ["/src/bar.cnx", makeFacts("bar.h", [makeVarSymbol("b", "u16")])],
    ]);

    const plan = HeaderEmissionPlanner.plan(facts, new HeaderGenerator());

    expect(plan.headersBySourcePath.size).toBe(2);
    expect(plan.headersBySourcePath.get("/src/foo.cnx")).toContain(
      "extern uint8_t a;",
    );
    expect(plan.headersBySourcePath.get("/src/bar.cnx")).toContain(
      "extern uint16_t b;",
    );
  });

  it("isolates one file's render failure into errorsBySourcePath, not headersBySourcePath", () => {
    const generator = new HeaderGenerator();
    vi.spyOn(generator, "generate").mockImplementationOnce(() => {
      throw new Error("boom");
    });
    const facts = new Map([["/src/bad.cnx", makeFacts("bad.h")]]);

    const plan = HeaderEmissionPlanner.plan(facts, generator);

    expect(plan.headersBySourcePath.has("/src/bad.cnx")).toBe(false);
    expect(plan.errorsBySourcePath.get("/src/bad.cnx")).toBe("boom");
  });

  it("does not let one file's render failure abort another file's render", () => {
    const generator = new HeaderGenerator();
    vi.spyOn(generator, "generate")
      .mockImplementationOnce(() => {
        throw new Error("boom");
      })
      .mockImplementationOnce(
        (...args: Parameters<typeof generator.generate>) =>
          HeaderGenerator.prototype.generate.apply(generator, args),
      );
    const facts = new Map([
      ["/src/bad.cnx", makeFacts("bad.h")],
      ["/src/good.cnx", makeFacts("good.h", [makeVarSymbol("c", "u32")])],
    ]);

    const plan = HeaderEmissionPlanner.plan(facts, generator);

    expect(plan.errorsBySourcePath.get("/src/bad.cnx")).toBe("boom");
    expect(plan.headersBySourcePath.get("/src/good.cnx")).toContain(
      "extern uint32_t c;",
    );
  });

  it("renders identically after CodeGenState has moved on to another file", () => {
    // This is the invariant HeaderEmissionPlanner exists to provide (#1323):
    // plan() reads no CodeGenState, only the facts it is handed. Captured
    // while CodeGenState said "this file needs the ISR typedef" --
    const facts = new Map([
      [
        "/src/foo.cnx",
        makeFacts("foo.h", undefined, { needsIsrTypedef: true }),
      ],
    ]);

    // -- then CodeGenState moves on to a later file that needs no such thing,
    // the same way the real per-file loop leaves it before Stage 5.5 runs.
    CodeGenState.needsISR = false;

    const plan = HeaderEmissionPlanner.plan(facts, new HeaderGenerator());

    // If plan() (or the generate() call path it uses) ever read live
    // CodeGenState.needsISR instead of the captured facts.options value,
    // this would render with no ISR typedef -- silently wrong, the same
    // failure mode #1139 was, and undetectable by any test that does not
    // deliberately make the live and captured values disagree.
    expect(plan.headersBySourcePath.get("/src/foo.cnx")).toContain(
      "typedef void (*ISR)(void);",
    );
  });

  it("stringifies a non-Error throw instead of losing it", () => {
    const generator = new HeaderGenerator();
    vi.spyOn(generator, "generate").mockImplementationOnce(() => {
      throw "not an Error instance";
    });
    const facts = new Map([["/src/weird.cnx", makeFacts("weird.h")]]);

    const plan = HeaderEmissionPlanner.plan(facts, generator);

    expect(plan.errorsBySourcePath.get("/src/weird.cnx")).toBe(
      "not an Error instance",
    );
  });
});
