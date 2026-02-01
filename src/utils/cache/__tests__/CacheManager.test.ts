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
import IStructFieldInfo from "../../../logic/symbols/types/IStructFieldInfo";

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
});
