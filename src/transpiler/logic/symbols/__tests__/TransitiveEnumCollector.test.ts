/**
 * Unit tests for TransitiveEnumCollector.
 * Issue #588: Extracted from Transpiler to logic layer.
 */

import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import TransitiveEnumCollector from "../TransitiveEnumCollector";
import ICodeGenSymbols from "../../../types/ICodeGenSymbols";

describe("TransitiveEnumCollector", () => {
  let testDir: string;

  // Helper to create a minimal ICodeGenSymbols
  function createSymbolInfo(
    knownEnums: string[] = [],
    knownStructs: string[] = [],
  ): ICodeGenSymbols {
    return {
      knownScopes: new Set<string>(),
      knownStructs: new Set(knownStructs),
      knownRegisters: new Set<string>(),
      knownEnums: new Set(knownEnums),
      knownBitmaps: new Set<string>(),
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
      opaqueTypes: new Set(),
      hasPublicSymbols: () => false,
    };
  }

  beforeEach(() => {
    testDir = join(
      tmpdir(),
      `transitive-enum-test-${Date.now()}-${Math.random()}`,
    );
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    try {
      rmSync(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe("aggregateKnownEnums", () => {
    it("should aggregate enums from multiple sources", () => {
      const infos: ICodeGenSymbols[] = [
        createSymbolInfo(["Status", "Mode"]),
        createSymbolInfo(["Priority", "Status"]), // Status duplicated
        createSymbolInfo(["ErrorCode"]),
      ];

      const result = TransitiveEnumCollector.aggregateKnownEnums(infos);

      expect(result.size).toBe(4);
      expect(result.has("Status")).toBe(true);
      expect(result.has("Mode")).toBe(true);
      expect(result.has("Priority")).toBe(true);
      expect(result.has("ErrorCode")).toBe(true);
    });

    it("should return empty set for empty input", () => {
      const result = TransitiveEnumCollector.aggregateKnownEnums([]);

      expect(result.size).toBe(0);
    });

    it("should handle sources with no enums", () => {
      const infos: ICodeGenSymbols[] = [
        createSymbolInfo([]),
        createSymbolInfo([]),
      ];

      const result = TransitiveEnumCollector.aggregateKnownEnums(infos);

      expect(result.size).toBe(0);
    });

    it("should handle single source", () => {
      const infos: ICodeGenSymbols[] = [createSymbolInfo(["OnlyEnum"])];

      const result = TransitiveEnumCollector.aggregateKnownEnums(infos);

      expect(result.size).toBe(1);
      expect(result.has("OnlyEnum")).toBe(true);
    });

    it("should work with Map.values() iterator", () => {
      const map = new Map<string, ICodeGenSymbols>([
        ["/path/a.cnx", createSymbolInfo(["EnumA"])],
        ["/path/b.cnx", createSymbolInfo(["EnumB"])],
      ]);

      const result = TransitiveEnumCollector.aggregateKnownEnums(map.values());

      expect(result.size).toBe(2);
      expect(result.has("EnumA")).toBe(true);
      expect(result.has("EnumB")).toBe(true);
    });
  });

  describe("collect", () => {
    it("should return empty array for file with no includes", () => {
      const rootFile = join(testDir, "root.cnx");
      writeFileSync(rootFile, "void main() { }");

      const symbolInfoByFile = new Map<string, ICodeGenSymbols>();

      const result = TransitiveEnumCollector.collect(
        rootFile,
        symbolInfoByFile,
        [],
      );

      expect(result).toEqual([]);
    });

    it("should collect symbol info from direct include", () => {
      // Create files
      const rootFile = join(testDir, "root.cnx");
      const includedFile = join(testDir, "types.cnx");

      writeFileSync(includedFile, "enum Status { OK, ERROR }");
      writeFileSync(rootFile, `#include "types.cnx"\nvoid main() { }`);

      const includedInfo = createSymbolInfo(["Status"]);
      const symbolInfoByFile = new Map<string, ICodeGenSymbols>([
        [includedFile, includedInfo],
      ]);

      const result = TransitiveEnumCollector.collect(
        rootFile,
        symbolInfoByFile,
        [],
      );

      expect(result).toHaveLength(1);
      expect(result[0].knownEnums.has("Status")).toBe(true);
    });

    it("should collect symbol info from transitive includes", () => {
      // Create files: root -> middle -> leaf
      const rootFile = join(testDir, "root.cnx");
      const middleFile = join(testDir, "middle.cnx");
      const leafFile = join(testDir, "leaf.cnx");

      writeFileSync(leafFile, "enum LeafEnum { A, B }");
      writeFileSync(middleFile, `#include "leaf.cnx"\nenum MiddleEnum { C }`);
      writeFileSync(rootFile, `#include "middle.cnx"\nvoid main() { }`);

      const leafInfo = createSymbolInfo(["LeafEnum"]);
      const middleInfo = createSymbolInfo(["MiddleEnum"]);
      const symbolInfoByFile = new Map<string, ICodeGenSymbols>([
        [leafFile, leafInfo],
        [middleFile, middleInfo],
      ]);

      const result = TransitiveEnumCollector.collect(
        rootFile,
        symbolInfoByFile,
        [],
      );

      expect(result).toHaveLength(2);
      const enumNames = result.flatMap((info) => Array.from(info.knownEnums));
      expect(enumNames).toContain("MiddleEnum");
      expect(enumNames).toContain("LeafEnum");
    });

    it("should handle circular includes without infinite loop", () => {
      // Create circular dependency: a -> b -> a
      const fileA = join(testDir, "a.cnx");
      const fileB = join(testDir, "b.cnx");

      writeFileSync(fileA, `#include "b.cnx"\nenum EnumA { X }`);
      writeFileSync(fileB, `#include "a.cnx"\nenum EnumB { Y }`);

      const infoA = createSymbolInfo(["EnumA"]);
      const infoB = createSymbolInfo(["EnumB"]);
      const symbolInfoByFile = new Map<string, ICodeGenSymbols>([
        [fileA, infoA],
        [fileB, infoB],
      ]);

      // Should not hang or throw
      const result = TransitiveEnumCollector.collect(
        fileA,
        symbolInfoByFile,
        [],
      );

      // When collecting from A: we get B's info (since A includes B)
      // The circular include from B->A doesn't add A's info because:
      // 1. A is the root file we're collecting FOR (its enums are already known)
      // 2. Each file is visited only once to prevent infinite loops
      expect(result).toHaveLength(1);
      const allEnums = result.flatMap((info) => Array.from(info.knownEnums));
      expect(allEnums).toContain("EnumB");
      expect(allEnums).not.toContain("EnumA"); // Root file's enums are not "external"
    });

    it("should handle missing files gracefully", () => {
      const rootFile = join(testDir, "root.cnx");
      writeFileSync(rootFile, `#include "nonexistent.cnx"\nvoid main() { }`);

      const symbolInfoByFile = new Map<string, ICodeGenSymbols>();

      // Should not throw
      const result = TransitiveEnumCollector.collect(
        rootFile,
        symbolInfoByFile,
        [],
      );

      expect(result).toEqual([]);
    });

    it("should handle file without symbol info in map", () => {
      const rootFile = join(testDir, "root.cnx");
      const includedFile = join(testDir, "types.cnx");

      writeFileSync(includedFile, "enum Status { OK }");
      writeFileSync(rootFile, `#include "types.cnx"\nvoid main() { }`);

      // Empty map - no symbol info registered
      const symbolInfoByFile = new Map<string, ICodeGenSymbols>();

      const result = TransitiveEnumCollector.collect(
        rootFile,
        symbolInfoByFile,
        [],
      );

      // Included file exists but has no symbol info
      expect(result).toEqual([]);
    });

    it("should use include directories to resolve includes", () => {
      // Create include directory structure
      const includeDir = join(testDir, "include");
      mkdirSync(includeDir, { recursive: true });

      const rootFile = join(testDir, "src", "root.cnx");
      const includedFile = join(includeDir, "types.cnx");

      mkdirSync(join(testDir, "src"), { recursive: true });
      writeFileSync(includedFile, "enum Status { OK }");
      writeFileSync(rootFile, `#include "types.cnx"\nvoid main() { }`);

      const includedInfo = createSymbolInfo(["Status"]);
      const symbolInfoByFile = new Map<string, ICodeGenSymbols>([
        [includedFile, includedInfo],
      ]);

      const result = TransitiveEnumCollector.collect(
        rootFile,
        symbolInfoByFile,
        [includeDir],
      );

      expect(result).toHaveLength(1);
      expect(result[0].knownEnums.has("Status")).toBe(true);
    });

    it("should skip C header includes (only process .cnx)", () => {
      const rootFile = join(testDir, "root.cnx");
      const cHeader = join(testDir, "legacy.h");
      const cnxFile = join(testDir, "types.cnx");

      writeFileSync(cHeader, "typedef int Status;");
      writeFileSync(cnxFile, "enum Status { OK }");
      writeFileSync(
        rootFile,
        `#include "legacy.h"\n#include "types.cnx"\nvoid main() { }`,
      );

      const cHeaderInfo = createSymbolInfo(["CHeaderType"]);
      const cnxInfo = createSymbolInfo(["Status"]);
      const symbolInfoByFile = new Map<string, ICodeGenSymbols>([
        [cHeader, cHeaderInfo],
        [cnxFile, cnxInfo],
      ]);

      const result = TransitiveEnumCollector.collect(
        rootFile,
        symbolInfoByFile,
        [],
      );

      // Should only include .cnx file info
      expect(result).toHaveLength(1);
      expect(result[0].knownEnums.has("Status")).toBe(true);
    });

    it("should collect from multiple direct includes", () => {
      const rootFile = join(testDir, "root.cnx");
      const file1 = join(testDir, "types1.cnx");
      const file2 = join(testDir, "types2.cnx");

      writeFileSync(file1, "enum Enum1 { A }");
      writeFileSync(file2, "enum Enum2 { B }");
      writeFileSync(
        rootFile,
        `#include "types1.cnx"\n#include "types2.cnx"\nvoid main() { }`,
      );

      const info1 = createSymbolInfo(["Enum1"]);
      const info2 = createSymbolInfo(["Enum2"]);
      const symbolInfoByFile = new Map<string, ICodeGenSymbols>([
        [file1, info1],
        [file2, info2],
      ]);

      const result = TransitiveEnumCollector.collect(
        rootFile,
        symbolInfoByFile,
        [],
      );

      expect(result).toHaveLength(2);
      const allEnums = result.flatMap((info) => Array.from(info.knownEnums));
      expect(allEnums).toContain("Enum1");
      expect(allEnums).toContain("Enum2");
    });

    it("should handle non-existent root file", () => {
      const rootFile = join(testDir, "nonexistent.cnx");
      const symbolInfoByFile = new Map<string, ICodeGenSymbols>();

      // Should not throw, just return empty
      const result = TransitiveEnumCollector.collect(
        rootFile,
        symbolInfoByFile,
        [],
      );

      expect(result).toEqual([]);
    });
  });

  describe("collectForStandalone", () => {
    it("should return empty array for empty includes", () => {
      const symbolInfoByFile = new Map<string, ICodeGenSymbols>();

      const result = TransitiveEnumCollector.collectForStandalone(
        [],
        symbolInfoByFile,
        [],
      );

      expect(result).toEqual([]);
    });

    it("should collect symbol info from direct includes", () => {
      const includedFile = join(testDir, "types.cnx");
      writeFileSync(includedFile, "enum Status { OK, ERROR }");

      const includedInfo = createSymbolInfo(["Status"]);
      const symbolInfoByFile = new Map<string, ICodeGenSymbols>([
        [includedFile, includedInfo],
      ]);

      const result = TransitiveEnumCollector.collectForStandalone(
        [{ path: includedFile }],
        symbolInfoByFile,
        [],
      );

      expect(result).toHaveLength(1);
      expect(result[0].knownEnums.has("Status")).toBe(true);
    });

    it("should collect symbol info from multiple includes", () => {
      const file1 = join(testDir, "types1.cnx");
      const file2 = join(testDir, "types2.cnx");

      writeFileSync(file1, "enum Enum1 { A }");
      writeFileSync(file2, "enum Enum2 { B }");

      const info1 = createSymbolInfo(["Enum1"]);
      const info2 = createSymbolInfo(["Enum2"]);
      const symbolInfoByFile = new Map<string, ICodeGenSymbols>([
        [file1, info1],
        [file2, info2],
      ]);

      const result = TransitiveEnumCollector.collectForStandalone(
        [{ path: file1 }, { path: file2 }],
        symbolInfoByFile,
        [],
      );

      expect(result).toHaveLength(2);
      const allEnums = result.flatMap((info) => Array.from(info.knownEnums));
      expect(allEnums).toContain("Enum1");
      expect(allEnums).toContain("Enum2");
    });

    it("should return empty when include has no symbol info in map", () => {
      const includedFile = join(testDir, "types.cnx");
      writeFileSync(includedFile, "enum Status { OK }");

      // Empty map - no symbol info registered
      const symbolInfoByFile = new Map<string, ICodeGenSymbols>();

      const result = TransitiveEnumCollector.collectForStandalone(
        [{ path: includedFile }],
        symbolInfoByFile,
        [],
      );

      expect(result).toEqual([]);
    });

    it("should collect from transitive includes", () => {
      // Create files: include -> nested
      const includeFile = join(testDir, "include.cnx");
      const nestedFile = join(testDir, "nested.cnx");

      writeFileSync(nestedFile, "enum NestedEnum { A, B }");
      writeFileSync(
        includeFile,
        `#include "nested.cnx"\nenum IncludeEnum { C }`,
      );

      const nestedInfo = createSymbolInfo(["NestedEnum"]);
      const includeInfo = createSymbolInfo(["IncludeEnum"]);
      const symbolInfoByFile = new Map<string, ICodeGenSymbols>([
        [nestedFile, nestedInfo],
        [includeFile, includeInfo],
      ]);

      const result = TransitiveEnumCollector.collectForStandalone(
        [{ path: includeFile }],
        symbolInfoByFile,
        [],
      );

      expect(result).toHaveLength(2);
      const allEnums = result.flatMap((info) => Array.from(info.knownEnums));
      expect(allEnums).toContain("IncludeEnum");
      expect(allEnums).toContain("NestedEnum");
    });

    it("should handle mix of found and missing symbol info", () => {
      const file1 = join(testDir, "found.cnx");
      const file2 = join(testDir, "missing.cnx");

      writeFileSync(file1, "enum Found { A }");
      writeFileSync(file2, "enum Missing { B }");

      // Only register info for file1
      const info1 = createSymbolInfo(["Found"]);
      const symbolInfoByFile = new Map<string, ICodeGenSymbols>([
        [file1, info1],
      ]);

      const result = TransitiveEnumCollector.collectForStandalone(
        [{ path: file1 }, { path: file2 }],
        symbolInfoByFile,
        [],
      );

      // Should only include the file with symbol info
      expect(result).toHaveLength(1);
      expect(result[0].knownEnums.has("Found")).toBe(true);
    });
  });
});
