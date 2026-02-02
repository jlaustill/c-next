/**
 * Unit tests for CacheManager.
 * Tests persistent cache for parsed C/C++ header symbols.
 */

import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import {
  writeFileSync,
  mkdirSync,
  rmSync,
  existsSync,
  readFileSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import CacheManager from "../CacheManager";
import ISymbol from "../../types/ISymbol";
import ESymbolKind from "../../types/ESymbolKind";
import ESourceLanguage from "../../types/ESourceLanguage";
import IStructFieldInfo from "../../../transpiler/logic/symbols/types/IStructFieldInfo";
import SymbolTable from "../../../transpiler/logic/symbols/SymbolTable";
import MockFileSystem from "../../../transpiler/__tests__/MockFileSystem";

describe("CacheManager", () => {
  let testDir: string;
  let cacheManager: CacheManager;

  // Helper to create a test symbol
  function createTestSymbol(overrides: Partial<ISymbol> = {}): ISymbol {
    return {
      name: "testFunc",
      kind: ESymbolKind.Function,
      sourceFile: "/test/file.h",
      sourceLine: 10,
      sourceLanguage: ESourceLanguage.C,
      isExported: true,
      ...overrides,
    };
  }

  // Helper to create test struct fields
  function createTestStructFields(): Map<
    string,
    Map<string, IStructFieldInfo>
  > {
    const fields = new Map<string, Map<string, IStructFieldInfo>>();
    const pointFields = new Map<string, IStructFieldInfo>();
    pointFields.set("x", { type: "int32_t" });
    pointFields.set("y", { type: "int32_t" });
    fields.set("Point", pointFields);
    return fields;
  }

  beforeEach(() => {
    // Create a unique test directory for each test
    testDir = join(
      tmpdir(),
      `cache-manager-test-${Date.now()}-${Math.random()}`,
    );
    mkdirSync(testDir, { recursive: true });
    cacheManager = new CacheManager(testDir);
  });

  afterEach(() => {
    // Clean up test directory
    try {
      rmSync(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
    vi.restoreAllMocks();
  });

  describe("initialize", () => {
    it("should create .cnx directory structure", async () => {
      await cacheManager.initialize();

      expect(existsSync(join(testDir, ".cnx"))).toBe(true);
      expect(existsSync(join(testDir, ".cnx", "cache"))).toBe(true);
    });

    it("should create config.json with correct structure", async () => {
      await cacheManager.initialize();

      const configPath = join(testDir, ".cnx", "config.json");
      expect(existsSync(configPath)).toBe(true);

      const config = JSON.parse(readFileSync(configPath, "utf-8"));
      expect(config).toHaveProperty("version");
      expect(config).toHaveProperty("created");
      expect(config).toHaveProperty("transpilerVersion");
      expect(typeof config.version).toBe("number");
      expect(typeof config.created).toBe("number");
      expect(typeof config.transpilerVersion).toBe("string");
    });

    it("should preserve existing valid cache", async () => {
      // First initialization
      await cacheManager.initialize();

      // Add some data
      const testFile = join(testDir, "test.h");
      writeFileSync(testFile, "// test");
      const symbol = createTestSymbol({ sourceFile: testFile });
      cacheManager.setSymbols(testFile, [symbol], new Map());
      await cacheManager.flush();

      // Create new manager and reinitialize
      const newManager = new CacheManager(testDir);
      await newManager.initialize();

      // Data should still be there
      const cached = newManager.getSymbols(testFile);
      expect(cached).not.toBeNull();
      expect(cached!.symbols).toHaveLength(1);
      expect(cached!.symbols[0].name).toBe("testFunc");
    });
  });

  describe("version invalidation", () => {
    it("should invalidate cache when version changes", async () => {
      // Create initial cache
      await cacheManager.initialize();

      const testFile = join(testDir, "test.h");
      writeFileSync(testFile, "// test");
      const symbol = createTestSymbol({ sourceFile: testFile });
      cacheManager.setSymbols(testFile, [symbol], new Map());
      await cacheManager.flush();

      // Modify config to have old version
      const configPath = join(testDir, ".cnx", "config.json");
      const config = JSON.parse(readFileSync(configPath, "utf-8"));
      config.version = 1; // Old version
      writeFileSync(configPath, JSON.stringify(config));

      // Reinitialize - should detect version mismatch and invalidate
      const newManager = new CacheManager(testDir);
      await newManager.initialize();

      // Cache should be empty
      const cached = newManager.getSymbols(testFile);
      expect(cached).toBeNull();
    });

    it("should invalidate cache when transpiler version changes", async () => {
      // Create initial cache
      await cacheManager.initialize();

      const testFile = join(testDir, "test.h");
      writeFileSync(testFile, "// test");
      const symbol = createTestSymbol({ sourceFile: testFile });
      cacheManager.setSymbols(testFile, [symbol], new Map());
      await cacheManager.flush();

      // Modify config to have old transpiler version
      const configPath = join(testDir, ".cnx", "config.json");
      const config = JSON.parse(readFileSync(configPath, "utf-8"));
      config.transpilerVersion = "0.0.0-old";
      writeFileSync(configPath, JSON.stringify(config));

      // Reinitialize - should detect version mismatch and invalidate
      const newManager = new CacheManager(testDir);
      await newManager.initialize();

      // Cache should be empty
      const cached = newManager.getSymbols(testFile);
      expect(cached).toBeNull();
    });
  });

  describe("symbol round-trip", () => {
    beforeEach(async () => {
      await cacheManager.initialize();
    });

    it("should store and retrieve basic symbols", async () => {
      const testFile = join(testDir, "test.h");
      writeFileSync(testFile, "// test");

      const symbol = createTestSymbol({ sourceFile: testFile });
      cacheManager.setSymbols(testFile, [symbol], new Map());

      const cached = cacheManager.getSymbols(testFile);
      expect(cached).not.toBeNull();
      expect(cached!.symbols).toHaveLength(1);
      expect(cached!.symbols[0]).toMatchObject({
        name: "testFunc",
        kind: ESymbolKind.Function,
        sourceFile: testFile,
        sourceLine: 10,
        sourceLanguage: ESourceLanguage.C,
        isExported: true,
      });
    });

    it("should preserve optional symbol fields", async () => {
      const testFile = join(testDir, "test.h");
      writeFileSync(testFile, "// test");

      const symbol = createTestSymbol({
        sourceFile: testFile,
        type: "int",
        isDeclaration: true,
        signature: "int testFunc(int a, float b)",
        parent: "MyClass",
        accessModifier: "rw",
        size: 32,
        parameters: [
          { name: "a", type: "int", isConst: false, isArray: false },
          { name: "b", type: "float", isConst: true, isArray: false },
        ],
      });
      cacheManager.setSymbols(testFile, [symbol], new Map());

      const cached = cacheManager.getSymbols(testFile);
      expect(cached!.symbols[0]).toMatchObject({
        type: "int",
        isDeclaration: true,
        signature: "int testFunc(int a, float b)",
        parent: "MyClass",
        accessModifier: "rw",
        size: 32,
      });
      expect(cached!.symbols[0].parameters).toHaveLength(2);
      expect(cached!.symbols[0].parameters![0]).toMatchObject({
        name: "a",
        type: "int",
        isConst: false,
        isArray: false,
      });
    });

    it("should handle multiple symbols", async () => {
      const testFile = join(testDir, "test.h");
      writeFileSync(testFile, "// test");

      const symbols = [
        createTestSymbol({
          sourceFile: testFile,
          name: "func1",
          kind: ESymbolKind.Function,
        }),
        createTestSymbol({
          sourceFile: testFile,
          name: "var1",
          kind: ESymbolKind.Variable,
        }),
        createTestSymbol({
          sourceFile: testFile,
          name: "MyStruct",
          kind: ESymbolKind.Struct,
        }),
      ];
      cacheManager.setSymbols(testFile, symbols, new Map());

      const cached = cacheManager.getSymbols(testFile);
      expect(cached!.symbols).toHaveLength(3);
      expect(cached!.symbols.map((s) => s.name)).toEqual([
        "func1",
        "var1",
        "MyStruct",
      ]);
    });

    it("should persist symbols across flush and reload", async () => {
      const testFile = join(testDir, "test.h");
      writeFileSync(testFile, "// test");

      const symbol = createTestSymbol({ sourceFile: testFile });
      cacheManager.setSymbols(testFile, [symbol], new Map());
      await cacheManager.flush();

      // Create new manager and reload
      const newManager = new CacheManager(testDir);
      await newManager.initialize();

      const cached = newManager.getSymbols(testFile);
      expect(cached).not.toBeNull();
      expect(cached!.symbols[0].name).toBe("testFunc");
    });
  });

  describe("struct fields serialization", () => {
    beforeEach(async () => {
      await cacheManager.initialize();
    });

    it("should store and retrieve struct fields", async () => {
      const testFile = join(testDir, "test.h");
      writeFileSync(testFile, "// test");

      const structFields = createTestStructFields();
      cacheManager.setSymbols(testFile, [], structFields);

      const cached = cacheManager.getSymbols(testFile);
      expect(cached!.structFields.has("Point")).toBe(true);

      const pointFields = cached!.structFields.get("Point")!;
      expect(pointFields.has("x")).toBe(true);
      expect(pointFields.get("x")).toEqual({ type: "int32_t" });
      expect(pointFields.has("y")).toBe(true);
      expect(pointFields.get("y")).toEqual({ type: "int32_t" });
    });

    it("should handle struct fields with array dimensions", async () => {
      const testFile = join(testDir, "test.h");
      writeFileSync(testFile, "// test");

      const structFields = new Map<string, Map<string, IStructFieldInfo>>();
      const bufferFields = new Map<string, IStructFieldInfo>();
      bufferFields.set("data", { type: "uint8_t", arrayDimensions: [256] });
      bufferFields.set("matrix", { type: "int32_t", arrayDimensions: [4, 4] });
      structFields.set("Buffer", bufferFields);

      cacheManager.setSymbols(testFile, [], structFields);

      const cached = cacheManager.getSymbols(testFile);
      const cachedBufferFields = cached!.structFields.get("Buffer")!;
      expect(cachedBufferFields.get("data")).toEqual({
        type: "uint8_t",
        arrayDimensions: [256],
      });
      expect(cachedBufferFields.get("matrix")).toEqual({
        type: "int32_t",
        arrayDimensions: [4, 4],
      });
    });

    it("should persist struct fields across flush and reload", async () => {
      const testFile = join(testDir, "test.h");
      writeFileSync(testFile, "// test");

      const structFields = createTestStructFields();
      cacheManager.setSymbols(testFile, [], structFields);
      await cacheManager.flush();

      // Reload
      const newManager = new CacheManager(testDir);
      await newManager.initialize();

      const cached = newManager.getSymbols(testFile);
      expect(cached!.structFields.get("Point")!.get("x")).toEqual({
        type: "int32_t",
      });
    });
  });

  describe("needsStructKeyword serialization", () => {
    beforeEach(async () => {
      await cacheManager.initialize();
    });

    it("should store and retrieve needsStructKeyword list", async () => {
      const testFile = join(testDir, "test.h");
      writeFileSync(testFile, "// test");

      cacheManager.setSymbols(testFile, [], new Map(), ["Point", "Rectangle"]);

      const cached = cacheManager.getSymbols(testFile);
      expect(cached!.needsStructKeyword).toEqual(["Point", "Rectangle"]);
    });

    it("should default to empty array when not provided", async () => {
      const testFile = join(testDir, "test.h");
      writeFileSync(testFile, "// test");

      cacheManager.setSymbols(testFile, [], new Map());

      const cached = cacheManager.getSymbols(testFile);
      expect(cached!.needsStructKeyword).toEqual([]);
    });
  });

  describe("enumBitWidth serialization (Issue #208)", () => {
    beforeEach(async () => {
      await cacheManager.initialize();
    });

    it("should store and retrieve enum bit widths", async () => {
      const testFile = join(testDir, "test.h");
      writeFileSync(testFile, "// test");

      const enumBitWidth = new Map<string, number>();
      enumBitWidth.set("Status", 8);
      enumBitWidth.set("Mode", 16);

      cacheManager.setSymbols(testFile, [], new Map(), undefined, enumBitWidth);

      const cached = cacheManager.getSymbols(testFile);
      expect(cached!.enumBitWidth.get("Status")).toBe(8);
      expect(cached!.enumBitWidth.get("Mode")).toBe(16);
    });

    it("should persist enum bit widths across flush and reload", async () => {
      const testFile = join(testDir, "test.h");
      writeFileSync(testFile, "// test");

      const enumBitWidth = new Map<string, number>();
      enumBitWidth.set("Priority", 32);

      cacheManager.setSymbols(testFile, [], new Map(), undefined, enumBitWidth);
      await cacheManager.flush();

      // Reload
      const newManager = new CacheManager(testDir);
      await newManager.initialize();

      const cached = newManager.getSymbols(testFile);
      expect(cached!.enumBitWidth.get("Priority")).toBe(32);
    });

    it("should handle missing enumBitWidth in old cache entries", async () => {
      const testFile = join(testDir, "test.h");
      writeFileSync(testFile, "// test");

      cacheManager.setSymbols(testFile, [], new Map());

      const cached = cacheManager.getSymbols(testFile);
      expect(cached!.enumBitWidth).toBeInstanceOf(Map);
      expect(cached!.enumBitWidth.size).toBe(0);
    });
  });

  describe("isValid", () => {
    beforeEach(async () => {
      await cacheManager.initialize();
    });

    it("should return false for uncached file", () => {
      expect(cacheManager.isValid("/nonexistent/file.h")).toBe(false);
    });

    it("should return true for unchanged cached file", async () => {
      const testFile = join(testDir, "test.h");
      writeFileSync(testFile, "// test");

      cacheManager.setSymbols(testFile, [], new Map());

      expect(cacheManager.isValid(testFile)).toBe(true);
    });

    it("should return false when file is modified", async () => {
      const testFile = join(testDir, "test.h");
      writeFileSync(testFile, "// test");

      cacheManager.setSymbols(testFile, [], new Map());

      // Wait and modify file to ensure mtime changes
      await new Promise((resolve) => setTimeout(resolve, 10));
      writeFileSync(testFile, "// modified");

      expect(cacheManager.isValid(testFile)).toBe(false);
    });
  });

  describe("invalidate", () => {
    beforeEach(async () => {
      await cacheManager.initialize();
    });

    it("should remove specific file from cache", () => {
      const testFile = join(testDir, "test.h");
      writeFileSync(testFile, "// test");

      cacheManager.setSymbols(
        testFile,
        [createTestSymbol({ sourceFile: testFile })],
        new Map(),
      );
      expect(cacheManager.getSymbols(testFile)).not.toBeNull();

      cacheManager.invalidate(testFile);
      expect(cacheManager.getSymbols(testFile)).toBeNull();
    });

    it("should not affect other cached files", () => {
      const file1 = join(testDir, "test1.h");
      const file2 = join(testDir, "test2.h");
      writeFileSync(file1, "// test1");
      writeFileSync(file2, "// test2");

      cacheManager.setSymbols(
        file1,
        [createTestSymbol({ sourceFile: file1, name: "func1" })],
        new Map(),
      );
      cacheManager.setSymbols(
        file2,
        [createTestSymbol({ sourceFile: file2, name: "func2" })],
        new Map(),
      );

      cacheManager.invalidate(file1);

      expect(cacheManager.getSymbols(file1)).toBeNull();
      expect(cacheManager.getSymbols(file2)).not.toBeNull();
      expect(cacheManager.getSymbols(file2)!.symbols[0].name).toBe("func2");
    });
  });

  describe("invalidateAll", () => {
    beforeEach(async () => {
      await cacheManager.initialize();
    });

    it("should clear all cached entries", () => {
      const file1 = join(testDir, "test1.h");
      const file2 = join(testDir, "test2.h");
      writeFileSync(file1, "// test1");
      writeFileSync(file2, "// test2");

      cacheManager.setSymbols(
        file1,
        [createTestSymbol({ sourceFile: file1 })],
        new Map(),
      );
      cacheManager.setSymbols(
        file2,
        [createTestSymbol({ sourceFile: file2 })],
        new Map(),
      );

      cacheManager.invalidateAll();

      expect(cacheManager.getSymbols(file1)).toBeNull();
      expect(cacheManager.getSymbols(file2)).toBeNull();
    });
  });

  describe("flush", () => {
    beforeEach(async () => {
      await cacheManager.initialize();
    });

    it("should not write when cache is not dirty", async () => {
      const symbolsPath = join(testDir, ".cnx", "cache", "symbols.json");

      // Flush without any changes
      await cacheManager.flush();

      // symbols.json should not exist (no data written)
      expect(existsSync(symbolsPath)).toBe(false);
    });

    it("should write symbols.json when cache is dirty", async () => {
      const testFile = join(testDir, "test.h");
      writeFileSync(testFile, "// test");

      cacheManager.setSymbols(
        testFile,
        [createTestSymbol({ sourceFile: testFile })],
        new Map(),
      );
      await cacheManager.flush();

      const symbolsPath = join(testDir, ".cnx", "cache", "symbols.json");
      expect(existsSync(symbolsPath)).toBe(true);

      const content = JSON.parse(readFileSync(symbolsPath, "utf-8"));
      expect(content.entries).toHaveLength(1);
    });

    it("should clear dirty flag after flush", async () => {
      const testFile = join(testDir, "test.h");
      writeFileSync(testFile, "// test");
      const symbolsPath = join(testDir, ".cnx", "cache", "symbols.json");

      cacheManager.setSymbols(testFile, [], new Map());
      await cacheManager.flush();

      const mtime1 = readFileSync(symbolsPath, "utf-8");

      // Second flush should not write (not dirty)
      await cacheManager.flush();

      const mtime2 = readFileSync(symbolsPath, "utf-8");
      expect(mtime1).toBe(mtime2);
    });
  });

  describe("corrupt cache handling", () => {
    it("should handle corrupt config.json gracefully", async () => {
      // Create corrupt config
      const cnxDir = join(testDir, ".cnx");
      mkdirSync(cnxDir, { recursive: true });
      writeFileSync(join(cnxDir, "config.json"), "not valid json{{{");

      // Should not throw, should create new config
      await cacheManager.initialize();

      const configPath = join(cnxDir, "config.json");
      const config = JSON.parse(readFileSync(configPath, "utf-8"));
      expect(config).toHaveProperty("version");
    });

    it("should handle corrupt symbols.json gracefully", async () => {
      // Create valid config but corrupt symbols
      const cnxDir = join(testDir, ".cnx");
      const cacheDir = join(cnxDir, "cache");
      mkdirSync(cacheDir, { recursive: true });

      // Create a valid config first (we need to match version)
      await cacheManager.initialize();

      // Now corrupt the symbols file
      writeFileSync(join(cacheDir, "symbols.json"), "invalid json");

      // Reinitialize - should handle gracefully
      const newManager = new CacheManager(testDir);
      await newManager.initialize();

      // Should have empty cache, not throw
      expect(newManager.getSymbols("/any/file.h")).toBeNull();
    });
  });

  describe("cache entry migration", () => {
    it("should migrate old mtime-based entries to cacheKey format", async () => {
      // Create cache with old format (mtime instead of cacheKey)
      await cacheManager.initialize();

      const testFile = join(testDir, "test.h");
      writeFileSync(testFile, "// test content");

      // Write old format cache entry directly
      const symbolsPath = join(testDir, ".cnx", "cache", "symbols.json");
      const oldFormatCache = {
        entries: [
          {
            filePath: testFile,
            mtime: Date.now(), // Old format used mtime
            symbols: [
              {
                name: "oldFunc",
                kind: "function",
                sourceFile: testFile,
                sourceLine: 1,
                sourceLanguage: "c",
                isExported: true,
              },
            ],
            structFields: {},
          },
        ],
      };
      writeFileSync(symbolsPath, JSON.stringify(oldFormatCache));

      // Reload with new manager
      const newManager = new CacheManager(testDir);
      await newManager.initialize();

      // Entry should be migrated and accessible
      const cached = newManager.getSymbols(testFile);
      expect(cached).not.toBeNull();
      expect(cached!.symbols[0].name).toBe("oldFunc");
    });

    it("should skip invalid entries during migration", async () => {
      await cacheManager.initialize();

      // Write cache with invalid entry (no mtime or cacheKey)
      const symbolsPath = join(testDir, ".cnx", "cache", "symbols.json");
      const invalidCache = {
        entries: [
          {
            filePath: "/some/file.h",
            // Missing both mtime and cacheKey
            symbols: [],
            structFields: {},
          },
        ],
      };
      writeFileSync(symbolsPath, JSON.stringify(invalidCache));

      // Reload - should not throw
      const newManager = new CacheManager(testDir);
      await newManager.initialize();

      // Invalid entry should be skipped
      expect(newManager.getSymbols("/some/file.h")).toBeNull();
    });
  });

  describe("setSymbols error handling", () => {
    beforeEach(async () => {
      await cacheManager.initialize();
    });

    it("should not cache non-existent file", () => {
      const nonExistentFile = join(testDir, "does-not-exist.h");

      // Should not throw, but also should not cache
      cacheManager.setSymbols(nonExistentFile, [createTestSymbol()], new Map());

      expect(cacheManager.getSymbols(nonExistentFile)).toBeNull();
    });
  });

  describe("getCacheDir", () => {
    it("should return correct cache directory path", () => {
      expect(cacheManager.getCacheDir()).toBe(join(testDir, ".cnx"));
    });
  });

  describe("all symbol kinds", () => {
    beforeEach(async () => {
      await cacheManager.initialize();
    });

    it("should handle all ESymbolKind values", async () => {
      const testFile = join(testDir, "test.h");
      writeFileSync(testFile, "// test");

      const symbols: ISymbol[] = [
        createTestSymbol({
          sourceFile: testFile,
          name: "func",
          kind: ESymbolKind.Function,
        }),
        createTestSymbol({
          sourceFile: testFile,
          name: "var",
          kind: ESymbolKind.Variable,
        }),
        createTestSymbol({
          sourceFile: testFile,
          name: "MyType",
          kind: ESymbolKind.Type,
        }),
        createTestSymbol({
          sourceFile: testFile,
          name: "ns",
          kind: ESymbolKind.Namespace,
        }),
        createTestSymbol({
          sourceFile: testFile,
          name: "MyClass",
          kind: ESymbolKind.Class,
        }),
        createTestSymbol({
          sourceFile: testFile,
          name: "MyStruct",
          kind: ESymbolKind.Struct,
        }),
        createTestSymbol({
          sourceFile: testFile,
          name: "MyEnum",
          kind: ESymbolKind.Enum,
        }),
        createTestSymbol({
          sourceFile: testFile,
          name: "VALUE",
          kind: ESymbolKind.EnumMember,
        }),
        createTestSymbol({
          sourceFile: testFile,
          name: "Flags",
          kind: ESymbolKind.Bitmap,
        }),
        createTestSymbol({
          sourceFile: testFile,
          name: "FLAG_A",
          kind: ESymbolKind.BitmapField,
        }),
        createTestSymbol({
          sourceFile: testFile,
          name: "REG",
          kind: ESymbolKind.Register,
        }),
        createTestSymbol({
          sourceFile: testFile,
          name: "FIELD",
          kind: ESymbolKind.RegisterMember,
        }),
      ];

      cacheManager.setSymbols(testFile, symbols, new Map());
      await cacheManager.flush();

      // Reload and verify
      const newManager = new CacheManager(testDir);
      await newManager.initialize();

      const cached = newManager.getSymbols(testFile);
      expect(cached!.symbols).toHaveLength(12);
      expect(cached!.symbols.map((s) => s.kind)).toEqual([
        ESymbolKind.Function,
        ESymbolKind.Variable,
        ESymbolKind.Type,
        ESymbolKind.Namespace,
        ESymbolKind.Class,
        ESymbolKind.Struct,
        ESymbolKind.Enum,
        ESymbolKind.EnumMember,
        ESymbolKind.Bitmap,
        ESymbolKind.BitmapField,
        ESymbolKind.Register,
        ESymbolKind.RegisterMember,
      ]);
    });
  });

  describe("all source languages", () => {
    beforeEach(async () => {
      await cacheManager.initialize();
    });

    it("should handle all ESourceLanguage values", async () => {
      const testFile = join(testDir, "test.h");
      writeFileSync(testFile, "// test");

      const symbols: ISymbol[] = [
        createTestSymbol({
          sourceFile: testFile,
          name: "cFunc",
          sourceLanguage: ESourceLanguage.C,
        }),
        createTestSymbol({
          sourceFile: testFile,
          name: "cppFunc",
          sourceLanguage: ESourceLanguage.Cpp,
        }),
        createTestSymbol({
          sourceFile: testFile,
          name: "cnextFunc",
          sourceLanguage: ESourceLanguage.CNext,
        }),
      ];

      cacheManager.setSymbols(testFile, symbols, new Map());
      await cacheManager.flush();

      // Reload and verify
      const newManager = new CacheManager(testDir);
      await newManager.initialize();

      const cached = newManager.getSymbols(testFile);
      expect(cached!.symbols.map((s) => s.sourceLanguage)).toEqual([
        ESourceLanguage.C,
        ESourceLanguage.Cpp,
        ESourceLanguage.CNext,
      ]);
    });
  });

  describe("setSymbolsFromTable (Issue #590)", () => {
    let symbolTable: SymbolTable;

    beforeEach(async () => {
      await cacheManager.initialize();
      symbolTable = new SymbolTable();
    });

    it("should extract and cache symbols from SymbolTable", async () => {
      const testFile = join(testDir, "test.cnx");
      writeFileSync(testFile, "// test");

      // Add symbols to SymbolTable
      const symbol: ISymbol = {
        name: "myFunction",
        kind: ESymbolKind.Function,
        sourceFile: testFile,
        sourceLine: 5,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
        type: "void",
      };
      symbolTable.addSymbol(symbol);

      // Cache via setSymbolsFromTable
      cacheManager.setSymbolsFromTable(testFile, symbolTable);

      // Verify cached data
      const cached = cacheManager.getSymbols(testFile);
      expect(cached).not.toBeNull();
      expect(cached!.symbols).toHaveLength(1);
      expect(cached!.symbols[0]).toMatchObject({
        name: "myFunction",
        kind: ESymbolKind.Function,
        sourceFile: testFile,
        sourceLine: 5,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
        type: "void",
      });
    });

    it("should extract struct fields for structs defined in the file", async () => {
      const testFile = join(testDir, "structs.cnx");
      writeFileSync(testFile, "// test");

      // Add struct symbol to SymbolTable
      const structSymbol: ISymbol = {
        name: "Point",
        kind: ESymbolKind.Struct,
        sourceFile: testFile,
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
      };
      symbolTable.addSymbol(structSymbol);

      // Add struct fields
      symbolTable.addStructField("Point", "x", "int32_t");
      symbolTable.addStructField("Point", "y", "int32_t");
      symbolTable.addStructField("Point", "data", "uint8_t", [10]);

      // Cache via setSymbolsFromTable
      cacheManager.setSymbolsFromTable(testFile, symbolTable);

      // Verify cached data
      const cached = cacheManager.getSymbols(testFile);
      expect(cached).not.toBeNull();
      expect(cached!.structFields.has("Point")).toBe(true);

      const pointFields = cached!.structFields.get("Point")!;
      expect(pointFields.get("x")).toEqual({ type: "int32_t" });
      expect(pointFields.get("y")).toEqual({ type: "int32_t" });
      expect(pointFields.get("data")).toEqual({
        type: "uint8_t",
        arrayDimensions: [10],
      });
    });

    it("should only extract struct fields for structs in the specified file", async () => {
      const file1 = join(testDir, "file1.cnx");
      const file2 = join(testDir, "file2.cnx");
      writeFileSync(file1, "// file1");
      writeFileSync(file2, "// file2");

      // Add struct in file1
      symbolTable.addSymbol({
        name: "PointA",
        kind: ESymbolKind.Struct,
        sourceFile: file1,
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
      });
      symbolTable.addStructField("PointA", "x", "int32_t");

      // Add struct in file2
      symbolTable.addSymbol({
        name: "PointB",
        kind: ESymbolKind.Struct,
        sourceFile: file2,
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
      });
      symbolTable.addStructField("PointB", "y", "int32_t");

      // Cache file1 only
      cacheManager.setSymbolsFromTable(file1, symbolTable);

      // Verify only file1's struct fields are cached
      const cached = cacheManager.getSymbols(file1);
      expect(cached).not.toBeNull();
      expect(cached!.structFields.has("PointA")).toBe(true);
      expect(cached!.structFields.has("PointB")).toBe(false);
    });

    it("should extract needsStructKeyword for structs in the file", async () => {
      const testFile = join(testDir, "cstructs.cnx");
      writeFileSync(testFile, "// test");

      // Add struct symbols
      symbolTable.addSymbol({
        name: "TypedefStruct",
        kind: ESymbolKind.Struct,
        sourceFile: testFile,
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
      });
      symbolTable.addSymbol({
        name: "NamedStruct",
        kind: ESymbolKind.Struct,
        sourceFile: testFile,
        sourceLine: 5,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
      });

      // Add struct fields (required for getStructNamesByFile)
      symbolTable.addStructField("TypedefStruct", "a", "int32_t");
      symbolTable.addStructField("NamedStruct", "b", "int32_t");

      // Mark one struct as needing 'struct' keyword
      symbolTable.markNeedsStructKeyword("NamedStruct");

      // Cache via setSymbolsFromTable
      cacheManager.setSymbolsFromTable(testFile, symbolTable);

      // Verify cached data
      const cached = cacheManager.getSymbols(testFile);
      expect(cached).not.toBeNull();
      expect(cached!.needsStructKeyword).toEqual(["NamedStruct"]);
    });

    it("should only extract needsStructKeyword for structs in the specified file", async () => {
      const file1 = join(testDir, "file1.cnx");
      const file2 = join(testDir, "file2.cnx");
      writeFileSync(file1, "// file1");
      writeFileSync(file2, "// file2");

      // Add structs in different files
      symbolTable.addSymbol({
        name: "StructA",
        kind: ESymbolKind.Struct,
        sourceFile: file1,
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
      });
      symbolTable.addSymbol({
        name: "StructB",
        kind: ESymbolKind.Struct,
        sourceFile: file2,
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
      });

      // Add struct fields
      symbolTable.addStructField("StructA", "a", "int32_t");
      symbolTable.addStructField("StructB", "b", "int32_t");

      // Mark both as needing struct keyword
      symbolTable.markNeedsStructKeyword("StructA");
      symbolTable.markNeedsStructKeyword("StructB");

      // Cache file1 only
      cacheManager.setSymbolsFromTable(file1, symbolTable);

      // Verify only file1's needsStructKeyword is cached
      const cached = cacheManager.getSymbols(file1);
      expect(cached).not.toBeNull();
      expect(cached!.needsStructKeyword).toEqual(["StructA"]);
      expect(cached!.needsStructKeyword).not.toContain("StructB");
    });

    it("should extract enum bit widths for enums in the file", async () => {
      const testFile = join(testDir, "enums.cnx");
      writeFileSync(testFile, "// test");

      // Add enum symbols
      symbolTable.addSymbol({
        name: "Status",
        kind: ESymbolKind.Enum,
        sourceFile: testFile,
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
      });
      symbolTable.addSymbol({
        name: "Priority",
        kind: ESymbolKind.Enum,
        sourceFile: testFile,
        sourceLine: 5,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
      });

      // Add enum bit widths
      symbolTable.addEnumBitWidth("Status", 8);
      symbolTable.addEnumBitWidth("Priority", 16);

      // Cache via setSymbolsFromTable
      cacheManager.setSymbolsFromTable(testFile, symbolTable);

      // Verify cached data
      const cached = cacheManager.getSymbols(testFile);
      expect(cached).not.toBeNull();
      expect(cached!.enumBitWidth.get("Status")).toBe(8);
      expect(cached!.enumBitWidth.get("Priority")).toBe(16);
    });

    it("should only extract enum bit widths for enums in the specified file", async () => {
      const file1 = join(testDir, "file1.cnx");
      const file2 = join(testDir, "file2.cnx");
      writeFileSync(file1, "// file1");
      writeFileSync(file2, "// file2");

      // Add enums in different files
      symbolTable.addSymbol({
        name: "EnumA",
        kind: ESymbolKind.Enum,
        sourceFile: file1,
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
      });
      symbolTable.addSymbol({
        name: "EnumB",
        kind: ESymbolKind.Enum,
        sourceFile: file2,
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
      });

      // Add bit widths for both
      symbolTable.addEnumBitWidth("EnumA", 8);
      symbolTable.addEnumBitWidth("EnumB", 32);

      // Cache file1 only
      cacheManager.setSymbolsFromTable(file1, symbolTable);

      // Verify only file1's enum bit widths are cached
      const cached = cacheManager.getSymbols(file1);
      expect(cached).not.toBeNull();
      expect(cached!.enumBitWidth.get("EnumA")).toBe(8);
      expect(cached!.enumBitWidth.has("EnumB")).toBe(false);
    });

    it("should handle file with all data types (symbols, structs, enums)", async () => {
      const testFile = join(testDir, "complete.cnx");
      writeFileSync(testFile, "// test");

      // Add function symbol
      symbolTable.addSymbol({
        name: "processData",
        kind: ESymbolKind.Function,
        sourceFile: testFile,
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
        type: "void",
      });

      // Add struct symbol and fields
      symbolTable.addSymbol({
        name: "DataPacket",
        kind: ESymbolKind.Struct,
        sourceFile: testFile,
        sourceLine: 10,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
      });
      symbolTable.addStructField("DataPacket", "id", "uint32_t");
      symbolTable.addStructField("DataPacket", "buffer", "uint8_t", [256]);
      symbolTable.markNeedsStructKeyword("DataPacket");

      // Add enum symbol and bit width
      symbolTable.addSymbol({
        name: "DataType",
        kind: ESymbolKind.Enum,
        sourceFile: testFile,
        sourceLine: 20,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
      });
      symbolTable.addEnumBitWidth("DataType", 8);

      // Cache via setSymbolsFromTable
      cacheManager.setSymbolsFromTable(testFile, symbolTable);

      // Verify all data is cached correctly
      const cached = cacheManager.getSymbols(testFile);
      expect(cached).not.toBeNull();

      // Verify symbols
      expect(cached!.symbols).toHaveLength(3);
      expect(cached!.symbols.map((s) => s.name).sort()).toEqual([
        "DataPacket",
        "DataType",
        "processData",
      ]);

      // Verify struct fields
      expect(cached!.structFields.has("DataPacket")).toBe(true);
      const fields = cached!.structFields.get("DataPacket")!;
      expect(fields.get("id")).toEqual({ type: "uint32_t" });
      expect(fields.get("buffer")).toEqual({
        type: "uint8_t",
        arrayDimensions: [256],
      });

      // Verify needsStructKeyword
      expect(cached!.needsStructKeyword).toEqual(["DataPacket"]);

      // Verify enumBitWidth
      expect(cached!.enumBitWidth.get("DataType")).toBe(8);
    });

    it("should persist data from setSymbolsFromTable across flush and reload", async () => {
      const testFile = join(testDir, "persist.cnx");
      writeFileSync(testFile, "// test");

      // Add data to SymbolTable
      symbolTable.addSymbol({
        name: "MyStruct",
        kind: ESymbolKind.Struct,
        sourceFile: testFile,
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
      });
      symbolTable.addStructField("MyStruct", "value", "int32_t");
      symbolTable.markNeedsStructKeyword("MyStruct");

      symbolTable.addSymbol({
        name: "MyEnum",
        kind: ESymbolKind.Enum,
        sourceFile: testFile,
        sourceLine: 5,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
      });
      symbolTable.addEnumBitWidth("MyEnum", 16);

      // Cache and flush
      cacheManager.setSymbolsFromTable(testFile, symbolTable);
      await cacheManager.flush();

      // Reload with new manager
      const newManager = new CacheManager(testDir);
      await newManager.initialize();

      // Verify all data persisted
      const cached = newManager.getSymbols(testFile);
      expect(cached).not.toBeNull();
      expect(cached!.symbols).toHaveLength(2);
      expect(cached!.structFields.get("MyStruct")!.get("value")).toEqual({
        type: "int32_t",
      });
      expect(cached!.needsStructKeyword).toEqual(["MyStruct"]);
      expect(cached!.enumBitWidth.get("MyEnum")).toBe(16);
    });

    it("should not cache non-existent file", () => {
      const nonExistent = join(testDir, "does-not-exist.cnx");

      // Add symbol for non-existent file
      symbolTable.addSymbol({
        name: "orphanFunc",
        kind: ESymbolKind.Function,
        sourceFile: nonExistent,
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
      });

      // Should not throw, but should not cache
      cacheManager.setSymbolsFromTable(nonExistent, symbolTable);

      expect(cacheManager.getSymbols(nonExistent)).toBeNull();
    });

    it("should handle empty SymbolTable", async () => {
      const testFile = join(testDir, "empty.cnx");
      writeFileSync(testFile, "// empty file");

      // Empty SymbolTable
      cacheManager.setSymbolsFromTable(testFile, symbolTable);

      // Should cache with empty data
      const cached = cacheManager.getSymbols(testFile);
      expect(cached).not.toBeNull();
      expect(cached!.symbols).toHaveLength(0);
      expect(cached!.structFields.size).toBe(0);
      expect(cached!.needsStructKeyword).toEqual([]);
      expect(cached!.enumBitWidth.size).toBe(0);
    });

    it("should handle structs without fields", async () => {
      const testFile = join(testDir, "emptystructs.cnx");
      writeFileSync(testFile, "// test");

      // Add struct symbol without adding any fields
      symbolTable.addSymbol({
        name: "EmptyStruct",
        kind: ESymbolKind.Struct,
        sourceFile: testFile,
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
      });
      // Note: not adding fields, so getStructNamesByFile won't include it

      cacheManager.setSymbolsFromTable(testFile, symbolTable);

      const cached = cacheManager.getSymbols(testFile);
      expect(cached).not.toBeNull();
      // Symbol should be there
      expect(cached!.symbols).toHaveLength(1);
      // But no struct fields (struct wasn't in getStructNamesByFile)
      expect(cached!.structFields.has("EmptyStruct")).toBe(false);
    });

    it("should handle enums without bit width", async () => {
      const testFile = join(testDir, "simpleenums.cnx");
      writeFileSync(testFile, "// test");

      // Add enum symbol without adding bit width
      symbolTable.addSymbol({
        name: "SimpleEnum",
        kind: ESymbolKind.Enum,
        sourceFile: testFile,
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
      });

      cacheManager.setSymbolsFromTable(testFile, symbolTable);

      const cached = cacheManager.getSymbols(testFile);
      expect(cached).not.toBeNull();
      expect(cached!.symbols).toHaveLength(1);
      // Enum bit width should not be present
      expect(cached!.enumBitWidth.has("SimpleEnum")).toBe(false);
    });

    it("should handle multiple symbols of same kind", async () => {
      const testFile = join(testDir, "multifuncs.cnx");
      writeFileSync(testFile, "// test");

      // Add multiple functions
      symbolTable.addSymbol({
        name: "func1",
        kind: ESymbolKind.Function,
        sourceFile: testFile,
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
      });
      symbolTable.addSymbol({
        name: "func2",
        kind: ESymbolKind.Function,
        sourceFile: testFile,
        sourceLine: 5,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
      });
      symbolTable.addSymbol({
        name: "func3",
        kind: ESymbolKind.Function,
        sourceFile: testFile,
        sourceLine: 10,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: false,
      });

      cacheManager.setSymbolsFromTable(testFile, symbolTable);

      const cached = cacheManager.getSymbols(testFile);
      expect(cached).not.toBeNull();
      expect(cached!.symbols).toHaveLength(3);
      expect(cached!.symbols.map((s) => s.name).sort()).toEqual([
        "func1",
        "func2",
        "func3",
      ]);
    });
  });

  describe("with MockFileSystem (IFileSystem integration)", () => {
    let mockFs: MockFileSystem;
    let cacheManager: CacheManager;

    beforeEach(() => {
      mockFs = new MockFileSystem();
      mockFs.addDirectory("/project");
      cacheManager = new CacheManager("/project", mockFs);
    });

    it("should create cache directories via IFileSystem", async () => {
      await cacheManager.initialize();

      const mkdirCalls = mockFs.getMkdirLog();
      expect(mkdirCalls.some((c) => c.path === "/project/.cnx")).toBe(true);
      expect(mkdirCalls.some((c) => c.path === "/project/.cnx/cache")).toBe(
        true,
      );
    });

    it("should write config.json via IFileSystem", async () => {
      await cacheManager.initialize();

      const content = mockFs.getWrittenContent("/project/.cnx/config.json");
      expect(content).toBeDefined();

      const config = JSON.parse(content!);
      expect(config).toHaveProperty("version");
      expect(config).toHaveProperty("created");
      expect(config).toHaveProperty("transpilerVersion");
    });

    it("should store and retrieve symbols without real file I/O", async () => {
      await cacheManager.initialize();

      // Add a virtual test file
      mockFs.addFile("/project/test.h", "// test header");

      const symbol: ISymbol = {
        name: "testFunc",
        kind: ESymbolKind.Function,
        sourceFile: "/project/test.h",
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.C,
        isExported: true,
      };

      cacheManager.setSymbols("/project/test.h", [symbol], new Map());

      const cached = cacheManager.getSymbols("/project/test.h");
      expect(cached).not.toBeNull();
      expect(cached!.symbols).toHaveLength(1);
      expect(cached!.symbols[0].name).toBe("testFunc");
    });

    it("should flush cache via IFileSystem", async () => {
      await cacheManager.initialize();

      mockFs.addFile("/project/test.h", "// test header");

      const symbol: ISymbol = {
        name: "myFunc",
        kind: ESymbolKind.Function,
        sourceFile: "/project/test.h",
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.C,
        isExported: true,
      };

      cacheManager.setSymbols("/project/test.h", [symbol], new Map());
      await cacheManager.flush();

      const content = mockFs.getWrittenContent(
        "/project/.cnx/cache/symbols.json",
      );
      expect(content).toBeDefined();

      const cacheData = JSON.parse(content!);
      expect(cacheData.entries).toHaveLength(1);
      expect(cacheData.entries[0].symbols[0].name).toBe("myFunc");
    });

    it("should validate cache using mtime from IFileSystem", async () => {
      await cacheManager.initialize();

      // Add file with specific mtime
      mockFs.addFile("/project/test.h", "// test header", 1000);

      cacheManager.setSymbols("/project/test.h", [], new Map());
      expect(cacheManager.isValid("/project/test.h")).toBe(true);

      // Change mtime to simulate file modification
      mockFs.setMtime("/project/test.h", 2000);
      expect(cacheManager.isValid("/project/test.h")).toBe(false);
    });

    it("should load existing cache via IFileSystem", async () => {
      // Pre-populate cache files in mock fs
      mockFs.addDirectory("/project/.cnx");
      mockFs.addDirectory("/project/.cnx/cache");

      // Add config.json
      const config = {
        version: 3,
        created: Date.now(),
        transpilerVersion: require("../../../../package.json").version,
      };
      mockFs.addFile("/project/.cnx/config.json", JSON.stringify(config));

      // Add test file and its cache entry
      mockFs.addFile("/project/cached.h", "// cached header", 5000);

      const cacheSymbols = {
        entries: [
          {
            filePath: "/project/cached.h",
            cacheKey: "mtime:5000",
            symbols: [
              {
                name: "cachedFunc",
                kind: "function",
                sourceFile: "/project/cached.h",
                sourceLine: 1,
                sourceLanguage: "c",
                isExported: true,
              },
            ],
            structFields: {},
          },
        ],
      };
      mockFs.addFile(
        "/project/.cnx/cache/symbols.json",
        JSON.stringify(cacheSymbols),
      );

      // Initialize and verify cache is loaded
      await cacheManager.initialize();

      const cached = cacheManager.getSymbols("/project/cached.h");
      expect(cached).not.toBeNull();
      expect(cached!.symbols[0].name).toBe("cachedFunc");
    });

    it("should handle struct fields with IFileSystem", async () => {
      await cacheManager.initialize();

      mockFs.addFile("/project/structs.h", "// struct header");

      const structFields = new Map<string, Map<string, IStructFieldInfo>>();
      const pointFields = new Map<string, IStructFieldInfo>();
      pointFields.set("x", { type: "int32_t" });
      pointFields.set("y", { type: "int32_t" });
      structFields.set("Point", pointFields);

      cacheManager.setSymbols("/project/structs.h", [], structFields);
      await cacheManager.flush();

      // Reload with new manager using same mock fs
      const newManager = new CacheManager("/project", mockFs);
      await newManager.initialize();

      const cached = newManager.getSymbols("/project/structs.h");
      expect(cached).not.toBeNull();
      expect(cached!.structFields.get("Point")!.get("x")).toEqual({
        type: "int32_t",
      });
    });

    it("should invalidate cache when version changes", async () => {
      // Pre-populate with old version cache
      mockFs.addDirectory("/project/.cnx");
      mockFs.addDirectory("/project/.cnx/cache");

      const oldConfig = {
        version: 1, // Old version
        created: Date.now(),
        transpilerVersion: "0.0.1",
      };
      mockFs.addFile("/project/.cnx/config.json", JSON.stringify(oldConfig));

      mockFs.addFile("/project/test.h", "// test", 1000);
      const oldCache = {
        entries: [
          {
            filePath: "/project/test.h",
            cacheKey: "mtime:1000",
            symbols: [],
            structFields: {},
          },
        ],
      };
      mockFs.addFile(
        "/project/.cnx/cache/symbols.json",
        JSON.stringify(oldCache),
      );

      await cacheManager.initialize();

      // Cache should be invalidated due to version mismatch
      const cached = cacheManager.getSymbols("/project/test.h");
      expect(cached).toBeNull();
    });

    it("should not cache files that do not exist in IFileSystem", async () => {
      await cacheManager.initialize();

      // Try to cache non-existent file
      cacheManager.setSymbols(
        "/project/nonexistent.h",
        [
          {
            name: "func",
            kind: ESymbolKind.Function,
            sourceFile: "/project/nonexistent.h",
            sourceLine: 1,
            sourceLanguage: ESourceLanguage.C,
            isExported: true,
          },
        ],
        new Map(),
      );

      // Should not be cached (stat() will fail)
      const cached = cacheManager.getSymbols("/project/nonexistent.h");
      expect(cached).toBeNull();
    });
  });
});
