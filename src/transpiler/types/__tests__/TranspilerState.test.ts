/**
 * Unit tests for TranspilerState
 * Issue #587: Tests state encapsulation, reset behavior, and typed accessors.
 */

import { describe, it, expect, beforeEach } from "vitest";
import TranspilerState from "../TranspilerState";
import ICodeGenSymbols from "../ICodeGenSymbols";

/** Create a minimal ICodeGenSymbols for testing */
function createMockSymbolInfo(enumName?: string): ICodeGenSymbols {
  const knownEnums = new Set<string>(enumName ? [enumName] : []);
  return {
    knownScopes: new Set(),
    knownStructs: new Set(),
    knownRegisters: new Set(),
    knownEnums,
    knownBitmaps: new Set(),
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
    scopeVariableUsage: new Map(),
    scopePrivateConstValues: new Map(),
    functionReturnTypes: new Map(),
    getSingleFunctionForVariable: () => null,
    hasPublicSymbols: () => false,
  };
}

describe("TranspilerState", () => {
  let state: TranspilerState;

  beforeEach(() => {
    state = new TranspilerState();
  });

  describe("reset()", () => {
    it("should clear all accumulated state", () => {
      // Populate all state groups
      state.setSymbolInfo("/path/file1.cnx", createMockSymbolInfo("Enum1"));
      state.setPassByValueParams(
        "/path/file1.cnx",
        new Map([["func", new Set(["param"])]]),
      );
      state.setUserIncludes("/path/file1.cnx", ['#include "types.h"']);
      state.setFileSymbolInfo("/path/file2.cnx", createMockSymbolInfo("Enum2"));
      state.setHeaderDirective("/path/header.h", '#include "header.h"');
      state.markHeaderProcessed("/path/header.h");

      // Verify state is populated
      expect(state.getSymbolInfo("/path/file1.cnx")).toBeDefined();
      expect(state.getPassByValueParams("/path/file1.cnx")).toBeDefined();
      expect(state.getUserIncludes("/path/file1.cnx")).toHaveLength(1);
      expect(state.getFileSymbolInfo("/path/file2.cnx")).toBeDefined();
      expect(state.getHeaderDirective("/path/header.h")).toBeDefined();
      expect(state.isHeaderProcessed("/path/header.h")).toBe(true);

      // Reset
      state.reset();

      // Verify all state is cleared
      expect(state.getSymbolInfo("/path/file1.cnx")).toBeUndefined();
      expect(state.getPassByValueParams("/path/file1.cnx")).toBeUndefined();
      expect(state.getUserIncludes("/path/file1.cnx")).toHaveLength(0);
      expect(state.getFileSymbolInfo("/path/file2.cnx")).toBeUndefined();
      expect(state.getHeaderDirective("/path/header.h")).toBeUndefined();
      expect(state.isHeaderProcessed("/path/header.h")).toBe(false);
    });
  });

  describe("Symbol Collectors (Group 1)", () => {
    it("should store and retrieve symbol info", () => {
      const info = createMockSymbolInfo("MyEnum");
      state.setSymbolInfo("/path/file.cnx", info);

      const retrieved = state.getSymbolInfo("/path/file.cnx");
      expect(retrieved).toBe(info);
      expect(retrieved?.knownEnums.has("MyEnum")).toBe(true);
    });

    it("should return undefined for missing symbol info", () => {
      expect(state.getSymbolInfo("/nonexistent.cnx")).toBeUndefined();
    });

    it("should iterate all symbol info", () => {
      state.setSymbolInfo("/path/a.cnx", createMockSymbolInfo("EnumA"));
      state.setSymbolInfo("/path/b.cnx", createMockSymbolInfo("EnumB"));

      const infos = [...state.getAllSymbolInfo()];
      expect(infos).toHaveLength(2);
    });
  });

  describe("Pass-By-Value Params (Group 1)", () => {
    it("should store and retrieve pass-by-value params", () => {
      const params = new Map<string, ReadonlySet<string>>([
        ["funcA", new Set(["x", "y"])],
        ["funcB", new Set(["z"])],
      ]);
      state.setPassByValueParams("/path/file.cnx", params);

      const retrieved = state.getPassByValueParams("/path/file.cnx");
      expect(retrieved).toBeDefined();
      expect(retrieved?.get("funcA")?.has("x")).toBe(true);
      expect(retrieved?.get("funcB")?.has("z")).toBe(true);
    });

    it("should return undefined for missing params", () => {
      expect(state.getPassByValueParams("/nonexistent.cnx")).toBeUndefined();
    });
  });

  describe("User Includes (Group 1)", () => {
    it("should store and retrieve user includes", () => {
      const includes = ['#include "types.h"', '#include "utils.h"'];
      state.setUserIncludes("/path/file.cnx", includes);

      const retrieved = state.getUserIncludes("/path/file.cnx");
      expect(retrieved).toEqual(includes);
    });

    it("should return empty array for missing includes", () => {
      expect(state.getUserIncludes("/nonexistent.cnx")).toEqual([]);
    });
  });

  describe("Symbol Info By File (Group 2)", () => {
    it("should store and retrieve file symbol info", () => {
      const info = createMockSymbolInfo("ExternalEnum");
      state.setFileSymbolInfo("/path/external.cnx", info);

      const retrieved = state.getFileSymbolInfo("/path/external.cnx");
      expect(retrieved).toBe(info);
    });

    it("should return undefined for missing file symbol info", () => {
      expect(state.getFileSymbolInfo("/nonexistent.cnx")).toBeUndefined();
    });

    it("should expose the entire map via getSymbolInfoByFileMap", () => {
      state.setFileSymbolInfo("/a.cnx", createMockSymbolInfo("A"));
      state.setFileSymbolInfo("/b.cnx", createMockSymbolInfo("B"));

      const map = state.getSymbolInfoByFileMap();
      expect(map.size).toBe(2);
      expect(map.has("/a.cnx")).toBe(true);
      expect(map.has("/b.cnx")).toBe(true);
    });
  });

  describe("Header Include Directives (Group 3)", () => {
    it("should store and retrieve header directives", () => {
      state.setHeaderDirective("/usr/include/stdint.h", "#include <stdint.h>");

      const retrieved = state.getHeaderDirective("/usr/include/stdint.h");
      expect(retrieved).toBe("#include <stdint.h>");
    });

    it("should return undefined for missing directives", () => {
      expect(state.getHeaderDirective("/nonexistent.h")).toBeUndefined();
    });

    it("should expose all directives via getAllHeaderDirectives", () => {
      state.setHeaderDirective("/a.h", "#include <a.h>");
      state.setHeaderDirective("/b.h", '#include "b.h"');

      const map = state.getAllHeaderDirectives();
      expect(map.size).toBe(2);
      expect(map.get("/a.h")).toBe("#include <a.h>");
      expect(map.get("/b.h")).toBe('#include "b.h"');
    });
  });

  describe("Processed Headers (Group 4)", () => {
    it("should track processed headers", () => {
      expect(state.isHeaderProcessed("/path/header.h")).toBe(false);

      state.markHeaderProcessed("/path/header.h");

      expect(state.isHeaderProcessed("/path/header.h")).toBe(true);
    });

    it("should handle multiple headers", () => {
      state.markHeaderProcessed("/a.h");
      state.markHeaderProcessed("/b.h");

      expect(state.isHeaderProcessed("/a.h")).toBe(true);
      expect(state.isHeaderProcessed("/b.h")).toBe(true);
      expect(state.isHeaderProcessed("/c.h")).toBe(false);
    });

    it("should be idempotent for marking", () => {
      state.markHeaderProcessed("/header.h");
      state.markHeaderProcessed("/header.h");

      expect(state.isHeaderProcessed("/header.h")).toBe(true);
    });

    it("should expose the Set via getProcessedHeadersSet", () => {
      state.markHeaderProcessed("/a.h");
      state.markHeaderProcessed("/b.h");

      const set = state.getProcessedHeadersSet();
      expect(set.size).toBe(2);
      expect(set.has("/a.h")).toBe(true);
      expect(set.has("/b.h")).toBe(true);
    });
  });

  describe("State Isolation", () => {
    it("should keep state groups independent", () => {
      // Set values in different groups with same key
      const key = "/same/path.cnx";
      state.setSymbolInfo(key, createMockSymbolInfo("A"));
      state.setFileSymbolInfo(key, createMockSymbolInfo("B"));
      state.setUserIncludes(key, ['#include "test.h"']);

      // Each group should have its own value
      expect(state.getSymbolInfo(key)?.knownEnums.has("A")).toBe(true);
      expect(state.getFileSymbolInfo(key)?.knownEnums.has("B")).toBe(true);
      expect(state.getUserIncludes(key)).toHaveLength(1);

      // Resetting clears all
      state.reset();
      expect(state.getSymbolInfo(key)).toBeUndefined();
      expect(state.getFileSymbolInfo(key)).toBeUndefined();
      expect(state.getUserIncludes(key)).toHaveLength(0);
    });
  });
});
