/**
 * Tests for HeaderEmissionPlanner
 * Issue #1323: the whole-program render step that turns every file's captured
 * IHeaderEmissionFacts into header text, reading no CodeGenState.
 */

import { describe, it, expect, vi } from "vitest";
import HeaderEmissionPlanner from "../HeaderEmissionPlanner";
import HeaderGenerator from "../HeaderGenerator";
import IHeaderEmissionFacts from "../../../types/IHeaderEmissionFacts";
import IHeaderSymbol from "../types/IHeaderSymbol";

describe("HeaderEmissionPlanner", () => {
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
  ): IHeaderEmissionFacts {
    return {
      symbols,
      filename,
      options: {},
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
