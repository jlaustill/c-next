/**
 * Unit tests for TransitiveEnumCollector.
 * Issue #588: Extracted from Transpiler to logic layer.
 *
 * #1435: the closure is taken over the include graph discovery resolved, so
 * these tests hand it a graph and no file exists anywhere. A collector that
 * read the disk, or built a search path, could not pass them.
 */

import { describe, expect, it } from "vitest";
import TransitiveEnumCollector from "../TransitiveEnumCollector";
import ICodeGenSymbols from "../../../transpiler/types/ICodeGenSymbols";

describe("TransitiveEnumCollector", () => {
  // Helper to create a minimal ICodeGenSymbols
  function createSymbolInfo(knownEnums: string[] = []): ICodeGenSymbols {
    return {
      knownScopes: new Set<string>(),
      knownStructs: new Set<string>(),
      knownRegisters: new Set<string>(),
      knownEnums: new Set(knownEnums),
      knownBitmaps: new Set<string>(),
      knownVariables: new Set<string>(),
      scopeMembers: new Map(),
      scopeMemberVisibility: new Map(),
      structFields: new Map(),
      structFieldArrays: new Map(),
      structFieldDimensions: new Map(),
      enumMembers: new Map(),
      bitmapFields: new Map(),
      bitmapBackingType: new Map(),
      bitmapBitWidth: new Map(),
      scopedRegisters: new Map(),
      registerMemberAccess: new Map(),
      registerMemberTypes: new Map(),
      registerBaseAddresses: new Map(),
      registerMemberOffsets: new Map(),
      registerMemberCTypes: new Map(),
      scopePrivateConstValues: new Map(),
      functionReturnTypes: new Map(),
    };
  }

  /** `{ a: ["b"] }` → a includes b. */
  function graph(
    edges: Record<string, string[]>,
  ): ReadonlyMap<string, ReadonlyArray<{ path: string }>> {
    return new Map(
      Object.entries(edges).map(([from, to]) => [
        from,
        to.map((path) => ({ path })),
      ]),
    );
  }

  /** Every named file declares one enum, named after the file. */
  function symbolsFor(...files: string[]): Map<string, ICodeGenSymbols> {
    return new Map(files.map((f) => [f, createSymbolInfo([`E_${f}`])]));
  }

  function enumsOf(result: { sources: ReadonlyArray<ICodeGenSymbols> }) {
    return result.sources.flatMap((s) => [...s.knownEnums]);
  }

  it("a file with no includes sees nothing beyond itself", () => {
    const result = TransitiveEnumCollector.collect(
      "a",
      graph({ a: [] }),
      symbolsFor("a"),
    );

    expect(result.paths).toEqual([]);
    expect(result.sources).toEqual([]);
  });

  it("a file with no entry in the graph includes nothing", () => {
    const result = TransitiveEnumCollector.collect(
      "a",
      graph({}),
      symbolsFor("a", "b"),
    );

    expect(result.paths).toEqual([]);
  });

  it("collects the transitive closure, each file before its includes", () => {
    const result = TransitiveEnumCollector.collect(
      "a",
      graph({ a: ["b", "c"], b: ["d"], c: ["d"], d: [] }),
      symbolsFor("a", "b", "c", "d"),
    );

    expect(result.paths).toEqual(["b", "d", "c"]);
    expect(enumsOf(result)).toEqual(["E_b", "E_d", "E_c"]);
  });

  it("a cycle back to the root never makes the root its own source", () => {
    const result = TransitiveEnumCollector.collect(
      "a",
      graph({ a: ["b"], b: ["a"] }),
      symbolsFor("a", "b"),
    );

    expect(result.paths).toEqual(["b"]);
    expect(enumsOf(result)).toEqual(["E_b"]);
  });

  it("a file that includes itself sees nothing beyond itself", () => {
    const result = TransitiveEnumCollector.collect(
      "a",
      graph({ a: ["a"] }),
      symbolsFor("a"),
    );

    expect(result.paths).toEqual([]);
  });

  it("an included file with no symbol info is visited but contributes nothing", () => {
    const result = TransitiveEnumCollector.collect(
      "a",
      graph({ a: ["b"], b: ["c"] }),
      symbolsFor("a", "c"),
    );

    expect(result.paths).toEqual(["b", "c"]);
    expect(enumsOf(result)).toEqual(["E_c"]);
  });
});
