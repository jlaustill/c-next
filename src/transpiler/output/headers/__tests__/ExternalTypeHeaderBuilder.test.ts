/**
 * Unit tests for ExternalTypeHeaderBuilder
 */

import { describe, it, expect } from "vitest";
import ExternalTypeHeaderBuilder from "../ExternalTypeHeaderBuilder";
import ISymbol from "../../../../utils/types/ISymbol";
import ESourceLanguage from "../../../../utils/types/ESourceLanguage";
import TSymbolKind from "../../../../utils/types/TSymbolKind";

/**
 * Create a minimal test symbol
 */
function createSymbol(
  name: string,
  kind: TSymbolKind,
  sourceFile: string,
): ISymbol {
  return {
    name,
    kind,
    sourceFile,
    sourceLine: 1,
    sourceLanguage: ESourceLanguage.C,
    isExported: false,
  };
}

/**
 * Mock symbol source for testing
 */
class MockSymbolSource {
  private symbolsByFile: Map<string, ISymbol[]> = new Map();

  addSymbols(filePath: string, symbols: ISymbol[]): void {
    this.symbolsByFile.set(filePath, symbols);
  }

  getSymbolsByFile(filePath: string): ISymbol[] {
    return this.symbolsByFile.get(filePath) ?? [];
  }
}

describe("ExternalTypeHeaderBuilder", () => {
  describe("build", () => {
    it("maps struct types to their include directives", () => {
      const source = new MockSymbolSource();
      source.addSymbols("/path/to/types.h", [
        createSymbol("MyStruct", "struct", "/path/to/types.h"),
      ]);

      const headerDirectives = new Map([
        ["/path/to/types.h", '#include "types.h"'],
      ]);

      const result = ExternalTypeHeaderBuilder.build(headerDirectives, source);

      expect(result.get("MyStruct")).toBe('#include "types.h"');
    });

    it("maps enum types to their include directives", () => {
      const source = new MockSymbolSource();
      source.addSymbols("/path/to/enums.h", [
        createSymbol("Status", "enum", "/path/to/enums.h"),
      ]);

      const headerDirectives = new Map([
        ["/path/to/enums.h", '#include "enums.h"'],
      ]);

      const result = ExternalTypeHeaderBuilder.build(headerDirectives, source);

      expect(result.get("Status")).toBe('#include "enums.h"');
    });

    it("maps typedef types to their include directives", () => {
      const source = new MockSymbolSource();
      source.addSymbols("/path/to/types.h", [
        createSymbol("size_t", "type", "/path/to/types.h"),
      ]);

      const headerDirectives = new Map([
        ["/path/to/types.h", '#include "types.h"'],
      ]);

      const result = ExternalTypeHeaderBuilder.build(headerDirectives, source);

      expect(result.get("size_t")).toBe('#include "types.h"');
    });

    it("maps class types to their include directives", () => {
      const source = new MockSymbolSource();
      source.addSymbols("/path/to/serial.hpp", [
        createSymbol("Serial", "class", "/path/to/serial.hpp"),
      ]);

      const headerDirectives = new Map([
        ["/path/to/serial.hpp", '#include "serial.hpp"'],
      ]);

      const result = ExternalTypeHeaderBuilder.build(headerDirectives, source);

      expect(result.get("Serial")).toBe('#include "serial.hpp"');
    });

    it("ignores function symbols", () => {
      const source = new MockSymbolSource();
      source.addSymbols("/path/to/funcs.h", [
        createSymbol("doSomething", "function", "/path/to/funcs.h"),
      ]);

      const headerDirectives = new Map([
        ["/path/to/funcs.h", '#include "funcs.h"'],
      ]);

      const result = ExternalTypeHeaderBuilder.build(headerDirectives, source);

      expect(result.has("doSomething")).toBe(false);
    });

    it("ignores variable symbols", () => {
      const source = new MockSymbolSource();
      source.addSymbols("/path/to/vars.h", [
        createSymbol("globalVar", "variable", "/path/to/vars.h"),
      ]);

      const headerDirectives = new Map([
        ["/path/to/vars.h", '#include "vars.h"'],
      ]);

      const result = ExternalTypeHeaderBuilder.build(headerDirectives, source);

      expect(result.has("globalVar")).toBe(false);
    });

    it("first include wins for duplicate type names", () => {
      const source = new MockSymbolSource();
      source.addSymbols("/path/to/first.h", [
        createSymbol("DuplicateType", "struct", "/path/to/first.h"),
      ]);
      source.addSymbols("/path/to/second.h", [
        createSymbol("DuplicateType", "struct", "/path/to/second.h"),
      ]);

      const headerDirectives = new Map([
        ["/path/to/first.h", '#include "first.h"'],
        ["/path/to/second.h", '#include "second.h"'],
      ]);

      const result = ExternalTypeHeaderBuilder.build(headerDirectives, source);

      expect(result.get("DuplicateType")).toBe('#include "first.h"');
    });

    it("handles multiple types from same header", () => {
      const source = new MockSymbolSource();
      source.addSymbols("/path/to/types.h", [
        createSymbol("StructA", "struct", "/path/to/types.h"),
        createSymbol("EnumB", "enum", "/path/to/types.h"),
        createSymbol("TypeC", "type", "/path/to/types.h"),
      ]);

      const headerDirectives = new Map([
        ["/path/to/types.h", '#include "types.h"'],
      ]);

      const result = ExternalTypeHeaderBuilder.build(headerDirectives, source);

      expect(result.get("StructA")).toBe('#include "types.h"');
      expect(result.get("EnumB")).toBe('#include "types.h"');
      expect(result.get("TypeC")).toBe('#include "types.h"');
    });

    it("handles multiple headers", () => {
      const source = new MockSymbolSource();
      source.addSymbols("/path/to/a.h", [
        createSymbol("TypeA", "struct", "/path/to/a.h"),
      ]);
      source.addSymbols("/path/to/b.h", [
        createSymbol("TypeB", "enum", "/path/to/b.h"),
      ]);

      const headerDirectives = new Map([
        ["/path/to/a.h", '#include "a.h"'],
        ["/path/to/b.h", '#include "b.h"'],
      ]);

      const result = ExternalTypeHeaderBuilder.build(headerDirectives, source);

      expect(result.get("TypeA")).toBe('#include "a.h"');
      expect(result.get("TypeB")).toBe('#include "b.h"');
    });

    it("returns empty map when no headers", () => {
      const source = new MockSymbolSource();
      const headerDirectives = new Map<string, string>();

      const result = ExternalTypeHeaderBuilder.build(headerDirectives, source);

      expect(result.size).toBe(0);
    });

    it("returns empty map when headers have no type symbols", () => {
      const source = new MockSymbolSource();
      source.addSymbols("/path/to/funcs.h", [
        createSymbol("func1", "function", "/path/to/funcs.h"),
        createSymbol("func2", "function", "/path/to/funcs.h"),
      ]);

      const headerDirectives = new Map([
        ["/path/to/funcs.h", '#include "funcs.h"'],
      ]);

      const result = ExternalTypeHeaderBuilder.build(headerDirectives, source);

      expect(result.size).toBe(0);
    });
  });
});
