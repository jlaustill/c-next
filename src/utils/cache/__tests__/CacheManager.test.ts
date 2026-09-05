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
import JsonCodec from "../JsonCodec";
import CachedSymbolReader from "../CachedSymbolReader";
import TJsonValue from "../../types/TJsonValue";
import TCSymbol from "../../../transpiler/types/symbols/c/TCSymbol";
import TCppSymbol from "../../../transpiler/types/symbols/cpp/TCppSymbol";
import ICFunctionSymbol from "../../../transpiler/types/symbols/c/ICFunctionSymbol";
import ESourceLanguage from "../../types/ESourceLanguage";
import IStructFieldInfo from "../../../transpiler/types/symbols/IStructFieldInfo";
import SymbolTable from "../../../transpiler/logic/symbols/SymbolTable";
import MockFileSystem from "../../../transpiler/__tests__/MockFileSystem";
import TTypeUtils from "../../TTypeUtils";
import type IFunctionSymbol from "../../../transpiler/types/symbols/IFunctionSymbol";
import TestSymbolUtils from "../../../PARSE/3-Declare/cnext/__tests__/testSymbolUtils";
import TestSourceSpan from "../../../transpiler/types/__testUtils__/testSourceSpan";

describe("CacheManager", () => {
  let testDir: string;
  let cacheManager: CacheManager;

  // Helper to create a test symbol.
  // Issue #1225: this is a real TCSymbol now, not the flat legacy shape. A
  // test that can express a symbol the model cannot hold proves nothing about
  // the production path.
  function createTestSymbol(
    overrides: Partial<ICFunctionSymbol> = {},
  ): ICFunctionSymbol {
    return {
      name: "testFunc",
      kind: "function",
      type: "void",
      sourceFile: "/test/file.h",
      span: TestSourceSpan.at(10),
      sourceLanguage: ESourceLanguage.C,
      visibility: "public",
      ...overrides,
    };
  }

  /** An empty struct state, derived rather than hand-written. */
  function emptyStructState(): ReturnType<SymbolTable["serializeStructState"]> {
    return new SymbolTable().serializeStructState();
  }

  /**
   * Store symbols the way production does: encoded, carrying struct state.
   * Keeps these tests on the same path `setSymbolsFromTable` uses, so they
   * cannot pass on a shape the transpiler never writes.
   */
  function storeSymbols(
    filePath: string,
    symbols: Array<TCSymbol | TCppSymbol>,
    structFields: Map<string, Map<string, IStructFieldInfo>> = new Map(),
    options: {
      needsStructKeyword?: string[];
      enumBitWidth?: Map<string, number>;
      preprocessFailed?: boolean;
    } = {},
  ): void {
    cacheManager.setSymbols(
      filePath,
      symbols.map((symbol) => JsonCodec.encode(symbol)),
      structFields,
      {
        structState: emptyStructState(),
        needsStructKeyword: options.needsStructKeyword,
        enumBitWidth: options.enumBitWidth,
        preprocessFailed: options.preprocessFailed,
      },
    );
  }

  /** Decode cached symbols the way the transpiler does. */
  function readSymbols(encoded: TJsonValue[]): Array<TCSymbol | TCppSymbol> {
    const symbols = CachedSymbolReader.read(encoded);
    expect(symbols).not.toBeNull();
    return symbols!;
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
      storeSymbols(testFile, [symbol], new Map());
      await cacheManager.flush();

      // Create new manager and reinitialize
      const newManager = new CacheManager(testDir);
      await newManager.initialize();

      // Data should still be there
      const cached = newManager.getSymbols(testFile);
      expect(cached).not.toBeNull();
      expect(readSymbols(cached!.symbols)).toHaveLength(1);
      expect(readSymbols(cached!.symbols)[0].name).toBe("testFunc");
    });
  });

  describe("version invalidation", () => {
    it("should invalidate cache when version changes", async () => {
      // Create initial cache
      await cacheManager.initialize();

      const testFile = join(testDir, "test.h");
      writeFileSync(testFile, "// test");
      const symbol = createTestSymbol({ sourceFile: testFile });
      storeSymbols(testFile, [symbol], new Map());
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

    it("invalidates the cache when the struct-state shape changes (#1225 review)", async () => {
      // TJsonSafe<Required<...>> forces the WRITER to persist a new field, but
      // nothing forced already-written entries to be discarded -- that was
      // CACHE_VERSION, bumped by hand, so the compile error told the next person
      // to write the field without mentioning a second step. The fingerprint is
      // derived from the serializer, so it closes that loop on its own.
      await cacheManager.initialize();

      const testFile = join(testDir, "test.h");
      writeFileSync(testFile, "// test");
      storeSymbols(testFile, [createTestSymbol({ sourceFile: testFile })]);
      await cacheManager.flush();

      const configPath = join(testDir, ".cnx", "config.json");
      const config = JSON.parse(readFileSync(configPath, "utf-8"));
      expect(config.structStateShape).toBe(
        SymbolTable.structStateKeys().join(","),
      );

      // Simulate a build whose IStructSymbolState had one fewer field.
      config.structStateShape = "opaqueTypes";
      writeFileSync(configPath, JSON.stringify(config));

      const newManager = new CacheManager(testDir);
      await newManager.initialize();

      expect(newManager.getSymbols(testFile)).toBeNull();
    });

    it("treats an entry with unreadable struct state as a miss (#1225 review)", async () => {
      // Not a throw, and not a silently-empty restore: both of those are the
      // defect. A miss costs a re-parse.
      await cacheManager.initialize();

      const testFile = join(testDir, "test.h");
      writeFileSync(testFile, "// test");
      storeSymbols(testFile, [createTestSymbol({ sourceFile: testFile })]);
      expect(cacheManager.getSymbols(testFile)).not.toBeNull();

      // Corrupt the struct state the way a truncated write or another tool would.
      cacheManager.setSymbols(testFile, [], new Map(), {
        structState: { opaqueTypes: 5 } as never,
      });

      expect(() => cacheManager.getSymbols(testFile)).not.toThrow();
      expect(cacheManager.getSymbols(testFile)).toBeNull();
    });

    it("should invalidate cache when transpiler version changes", async () => {
      // Create initial cache
      await cacheManager.initialize();

      const testFile = join(testDir, "test.h");
      writeFileSync(testFile, "// test");
      const symbol = createTestSymbol({ sourceFile: testFile });
      storeSymbols(testFile, [symbol], new Map());
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
      storeSymbols(testFile, [symbol], new Map());

      const cached = cacheManager.getSymbols(testFile);
      expect(cached).not.toBeNull();
      expect(readSymbols(cached!.symbols)).toHaveLength(1);
      expect(cached!.symbols[0]).toMatchObject({
        name: "testFunc",
        kind: "function",
        sourceFile: testFile,
        span: TestSourceSpan.at(10),
        sourceLanguage: ESourceLanguage.C,
        visibility: "public",
      });
    });

    it("defaults preprocessFailed to false and round-trips it when set", async () => {
      const cleanFile = join(testDir, "clean.h");
      const failedFile = join(testDir, "failed.h");
      writeFileSync(cleanFile, "// test");
      writeFileSync(failedFile, "// test");

      // Issue #985: a header that fell back to raw content records that fact so
      // a warm-cache build re-runs external-declaration recovery.
      storeSymbols(cleanFile, [], new Map());
      storeSymbols(failedFile, [], new Map(), {
        preprocessFailed: true,
      });

      expect(cacheManager.getSymbols(cleanFile)!.preprocessFailed).toBe(false);
      expect(cacheManager.getSymbols(failedFile)!.preprocessFailed).toBe(true);
    });

    it("preserves optional symbol fields through the production path", () => {
      const testFile = join(testDir, "test.h");
      writeFileSync(testFile, "// test");

      // Issue #1225: this test used to hand-build a flat entry and call
      // setSymbols directly, bypassing serializeTypedSymbol entirely. It
      // asserted that signature/parent/accessModifier/size round-trip --
      // fields the production serializer never wrote, and that the C symbol
      // model does not even have. It proved the storage layer was lossless,
      // never that the cache was. It now goes through setSymbolsFromTable,
      // which is the path the transpiler actually takes.
      const symbolTable = new SymbolTable();
      symbolTable.addCSymbol({
        name: "testFunc",
        kind: "function",
        type: "int",
        sourceFile: testFile,
        span: TestSourceSpan.at(10),
        sourceLanguage: ESourceLanguage.C,
        visibility: "public",
        isDeclaration: true,
        parameters: [
          { name: "a", type: "int", isConst: false, isArray: false },
          { name: "b", type: "float", isConst: true, isArray: false },
        ],
      });

      cacheManager.setSymbolsFromTable(testFile, symbolTable);

      const restored = readSymbols(cacheManager.getSymbols(testFile)!.symbols);
      const restoredFunction = restored[0] as Extract<
        TCSymbol,
        { kind: "function" }
      >;
      expect(restoredFunction).toMatchObject({
        type: "int",
        // #1214 and #1225 both hid here: isDeclaration was serialized by
        // nobody and restored from nothing.
        isDeclaration: true,
      });
      expect(restoredFunction.parameters).toHaveLength(2);
      // #1214: a parameter's isConst was dropped by the old adapter, so warm
      // and cold caches disagreed about `const T*` versus `T*`.
      expect(restoredFunction.parameters![1]).toMatchObject({
        name: "b",
        type: "float",
        isConst: true,
        isArray: false,
      });
    });

    it("should handle multiple symbols", async () => {
      const testFile = join(testDir, "test.h");
      writeFileSync(testFile, "// test");

      const base = {
        sourceFile: testFile,
        span: TestSourceSpan.at(10),
        sourceLanguage: ESourceLanguage.C as const,
        visibility: "public" as const,
      };
      const symbols: TCSymbol[] = [
        { ...base, kind: "function", name: "func1", type: "void" },
        { ...base, kind: "variable", name: "var1", type: "int" },
        { ...base, kind: "struct", name: "MyStruct", isUnion: false },
      ];
      storeSymbols(testFile, symbols, new Map());

      const cached = cacheManager.getSymbols(testFile);
      expect(readSymbols(cached!.symbols)).toHaveLength(3);
      expect(readSymbols(cached!.symbols).map((s) => s.name)).toEqual([
        "func1",
        "var1",
        "MyStruct",
      ]);
    });

    it("should persist symbols across flush and reload", async () => {
      const testFile = join(testDir, "test.h");
      writeFileSync(testFile, "// test");

      const symbol = createTestSymbol({ sourceFile: testFile });
      storeSymbols(testFile, [symbol], new Map());
      await cacheManager.flush();

      // Create new manager and reload
      const newManager = new CacheManager(testDir);
      await newManager.initialize();

      const cached = newManager.getSymbols(testFile);
      expect(cached).not.toBeNull();
      expect(readSymbols(cached!.symbols)[0].name).toBe("testFunc");
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
      storeSymbols(testFile, [], structFields);

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

      storeSymbols(testFile, [], structFields);

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
      storeSymbols(testFile, [], structFields);
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

      storeSymbols(testFile, [], new Map(), {
        needsStructKeyword: ["Point", "Rectangle"],
      });

      const cached = cacheManager.getSymbols(testFile);
      expect(cached!.needsStructKeyword).toEqual(["Point", "Rectangle"]);
    });

    it("should default to empty array when not provided", async () => {
      const testFile = join(testDir, "test.h");
      writeFileSync(testFile, "// test");

      storeSymbols(testFile, [], new Map());

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

      storeSymbols(testFile, [], new Map(), { enumBitWidth });

      const cached = cacheManager.getSymbols(testFile);
      expect(cached!.enumBitWidth.get("Status")).toBe(8);
      expect(cached!.enumBitWidth.get("Mode")).toBe(16);
    });

    it("should persist enum bit widths across flush and reload", async () => {
      const testFile = join(testDir, "test.h");
      writeFileSync(testFile, "// test");

      const enumBitWidth = new Map<string, number>();
      enumBitWidth.set("Priority", 32);

      storeSymbols(testFile, [], new Map(), { enumBitWidth });
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

      storeSymbols(testFile, [], new Map());

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

      storeSymbols(testFile, [], new Map());

      expect(cacheManager.isValid(testFile)).toBe(true);
    });

    it("should return false when file is modified", async () => {
      const testFile = join(testDir, "test.h");
      writeFileSync(testFile, "// test");

      storeSymbols(testFile, [], new Map());

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

      storeSymbols(
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

      storeSymbols(
        file1,
        [createTestSymbol({ sourceFile: file1, name: "func1" })],
        new Map(),
      );
      storeSymbols(
        file2,
        [createTestSymbol({ sourceFile: file2, name: "func2" })],
        new Map(),
      );

      cacheManager.invalidate(file1);

      expect(cacheManager.getSymbols(file1)).toBeNull();
      expect(cacheManager.getSymbols(file2)).not.toBeNull();
      expect(readSymbols(cacheManager.getSymbols(file2)!.symbols)[0].name).toBe(
        "func2",
      );
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

      storeSymbols(file1, [createTestSymbol({ sourceFile: file1 })], new Map());
      storeSymbols(file2, [createTestSymbol({ sourceFile: file2 })], new Map());

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
      // flat-cache v6 uses filename without extension
      const symbolsPath = join(testDir, ".cnx", "cache", "symbols");

      // Flush without any changes
      await cacheManager.flush();

      // symbols file should not exist (no data written)
      expect(existsSync(symbolsPath)).toBe(false);
    });

    it("should write symbols file when cache is dirty", async () => {
      const testFile = join(testDir, "test.h");
      writeFileSync(testFile, "// test");

      storeSymbols(
        testFile,
        [createTestSymbol({ sourceFile: testFile })],
        new Map(),
      );
      await cacheManager.flush();

      // flat-cache v6 uses filename without extension
      const symbolsPath = join(testDir, ".cnx", "cache", "symbols");
      expect(existsSync(symbolsPath)).toBe(true);
    });

    it("should clear dirty flag after flush", async () => {
      const testFile = join(testDir, "test.h");
      writeFileSync(testFile, "// test");
      // flat-cache v6 uses filename without extension
      const symbolsPath = join(testDir, ".cnx", "cache", "symbols");

      storeSymbols(testFile, [], new Map());
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

  describe("cache persistence", () => {
    // Note: Migration from old mtime-based format to cacheKey format is handled
    // by CacheManager.migrateOldEntries(). However, testing this directly is
    // impractical because flat-cache v6 uses its own serialization format (flatted).
    // The migration code exists for users upgrading from older C-Next versions
    // where the cache file was manually written as JSON. New installs use
    // flat-cache's internal format from the start.

    it("should persist and reload cache entries correctly", async () => {
      await cacheManager.initialize();

      const testFile = join(testDir, "test.h");
      writeFileSync(testFile, "// test content");

      // Set an entry
      storeSymbols(
        testFile,
        [createTestSymbol({ sourceFile: testFile, name: "persistedFunc" })],
        new Map(),
      );
      await cacheManager.flush();

      // Reload with new manager - entry should be accessible
      const newManager = new CacheManager(testDir);
      await newManager.initialize();

      // Entry should be accessible
      const cached = newManager.getSymbols(testFile);
      expect(cached).not.toBeNull();
      expect(readSymbols(cached!.symbols)[0].name).toBe("persistedFunc");
    });

    it("should return null for non-existent entries", async () => {
      await cacheManager.initialize();

      // Non-existent entry should be null
      expect(cacheManager.getSymbols("/some/nonexistent/file.h")).toBeNull();
    });
  });

  describe("setSymbols error handling", () => {
    beforeEach(async () => {
      await cacheManager.initialize();
    });

    it("should not cache non-existent file", () => {
      const nonExistentFile = join(testDir, "does-not-exist.h");

      // Should not throw, but also should not cache
      storeSymbols(nonExistentFile, [createTestSymbol()], new Map());

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

    // Issue #1225: these are the kinds TSymbolKindC and TSymbolKindCpp
    // actually define. The previous version of this test also listed C-Next
    // kinds (bitmap, register_member, ...) because the flat legacy shape could
    // hold any string -- but no C-Next symbol is ever cached, so it asserted a
    // capability of the serializer rather than of the transpiler.
    it("round-trips every C symbol kind", async () => {
      const testFile = join(testDir, "test.h");
      writeFileSync(testFile, "// test");

      const base = {
        sourceFile: testFile,
        span: TestSourceSpan.at(1),
        sourceLanguage: ESourceLanguage.C as const,
        visibility: "public" as const,
      };
      const fields = new Map([["x", { name: "x", type: "int" }]]);
      const symbols: TCSymbol[] = [
        { ...base, kind: "function", name: "func", type: "void" },
        { ...base, kind: "variable", name: "var", type: "int" },
        { ...base, kind: "struct", name: "MyStruct", isUnion: false, fields },
        {
          ...base,
          kind: "enum",
          name: "MyEnum",
          members: [{ name: "A", value: 0 }],
        },
        { ...base, kind: "enum_member", name: "A", parent: "MyEnum", value: 0 },
        { ...base, kind: "type", name: "MyType", type: "int" },
      ];

      storeSymbols(testFile, symbols, new Map());
      await cacheManager.flush();

      const newManager = new CacheManager(testDir);
      await newManager.initialize();
      const restored = readSymbols(newManager.getSymbols(testFile)!.symbols);

      expect(restored.map((symbol) => symbol.kind)).toEqual([
        "function",
        "variable",
        "struct",
        "enum",
        "enum_member",
        "type",
      ]);
      // The struct's field Map is the one non-JSON construct in the model;
      // it must come back as a Map, not as an object or an empty stand-in.
      const struct = restored[2] as Extract<TCSymbol, { kind: "struct" }>;
      expect(struct.fields).toBeInstanceOf(Map);
      expect(struct.fields!.get("x")).toEqual({ name: "x", type: "int" });
      const cEnum = restored[3] as Extract<TCSymbol, { kind: "enum" }>;
      expect(cEnum.members).toEqual([{ name: "A", value: 0 }]);
    });

    it("round-trips every C++ symbol kind", async () => {
      const testFile = join(testDir, "test.hpp");
      writeFileSync(testFile, "// test");

      const base = {
        sourceFile: testFile,
        span: TestSourceSpan.at(1),
        sourceLanguage: ESourceLanguage.Cpp as const,
        visibility: "public" as const,
      };
      const symbols: TCppSymbol[] = [
        { ...base, kind: "function", name: "func", type: "void" },
        { ...base, kind: "variable", name: "var", type: "int" },
        { ...base, kind: "struct", name: "MyStruct" },
        { ...base, kind: "class", name: "MyClass", parent: "Outer" },
        { ...base, kind: "namespace", name: "ns" },
        { ...base, kind: "enum", name: "MyEnum", bitWidth: 8 },
        { ...base, kind: "enum_member", name: "A", value: 0 },
        { ...base, kind: "type", name: "MyAlias", type: "int" },
      ];

      storeSymbols(testFile, symbols, new Map());
      await cacheManager.flush();

      const newManager = new CacheManager(testDir);
      await newManager.initialize();
      const restored = readSymbols(newManager.getSymbols(testFile)!.symbols);

      expect(restored.map((symbol) => symbol.kind)).toEqual([
        "function",
        "variable",
        "struct",
        "class",
        "namespace",
        "enum",
        "enum_member",
        "type",
      ]);
      // #1214: parent and bitWidth were both dropped by the old adapter.
      const cppClass = restored[3] as Extract<TCppSymbol, { kind: "class" }>;
      expect(cppClass.parent).toBe("Outer");
      const cppEnum = restored[5] as Extract<TCppSymbol, { kind: "enum" }>;
      expect(cppEnum.bitWidth).toBe(8);
    });
  });

  describe("all source languages", () => {
    beforeEach(async () => {
      await cacheManager.initialize();
    });

    it("round-trips C and C++ symbols", async () => {
      const testFile = join(testDir, "test.h");
      writeFileSync(testFile, "// test");

      const symbols: Array<TCSymbol | TCppSymbol> = [
        createTestSymbol({ sourceFile: testFile, name: "cFunc" }),
        {
          name: "cppFunc",
          kind: "function",
          type: "void",
          sourceFile: testFile,
          span: TestSourceSpan.at(10),
          sourceLanguage: ESourceLanguage.Cpp,
          visibility: "public",
        },
      ];

      storeSymbols(testFile, symbols, new Map());
      await cacheManager.flush();

      const newManager = new CacheManager(testDir);
      await newManager.initialize();
      const restored = readSymbols(newManager.getSymbols(testFile)!.symbols);

      expect(restored.map((symbol) => symbol.sourceLanguage)).toEqual([
        ESourceLanguage.C,
        ESourceLanguage.Cpp,
      ]);
    });

    it("rejects a C-Next symbol rather than reviving one", () => {
      // Issue #1225: C-Next symbols are re-parsed from source every run and
      // are never cached. One appearing in an entry means the entry is not
      // what it claims to be, so the whole entry is discarded -- which reads
      // as a cache miss and costs a re-parse, not a wrong header.
      const encoded = [
        JsonCodec.encode({
          name: "cnextFunc",
          kind: "function",
          sourceFile: "/test/file.cnx",
          span: TestSourceSpan.at(1),
          sourceLanguage: ESourceLanguage.CNext,
          visibility: "public",
        }),
      ];

      expect(CachedSymbolReader.read(encoded)).toBeNull();
    });
  });

  describe("setSymbolsFromTable (Issue #590)", () => {
    let symbolTable: SymbolTable;

    beforeEach(async () => {
      await cacheManager.initialize();
      symbolTable = new SymbolTable();
    });

    it("should extract and cache symbols from SymbolTable", () => {
      const testFile = join(testDir, "test.h");
      writeFileSync(testFile, "// test");

      symbolTable.addCSymbol({
        name: "myFunction",
        kind: "function",
        type: "void",
        sourceFile: testFile,
        span: TestSourceSpan.at(5),
        sourceLanguage: ESourceLanguage.C,
        visibility: "public",
      });

      cacheManager.setSymbolsFromTable(testFile, symbolTable);

      const cached = cacheManager.getSymbols(testFile);
      expect(cached).not.toBeNull();
      expect(readSymbols(cached!.symbols)).toHaveLength(1);
      expect(readSymbols(cached!.symbols)[0]).toMatchObject({
        name: "myFunction",
        kind: "function",
        sourceFile: testFile,
        span: TestSourceSpan.at(5),
        sourceLanguage: ESourceLanguage.C,
        visibility: "public",
        type: "void",
      });
    });

    it("does not cache C-Next symbols (#1225)", () => {
      // setSymbolsFromTable only ever runs on a .h/.hpp, and the restore path
      // always skipped C-Next symbols anyway -- so writing them was work whose
      // result was guaranteed to be discarded. The filter makes that invariant
      // explicit, and CachedSymbolReader now rejects an entry containing one.
      const headerFile = join(testDir, "mixed.h");
      writeFileSync(headerFile, "// test");

      symbolTable.addCSymbol({
        name: "cFunction",
        kind: "function",
        type: "void",
        sourceFile: headerFile,
        span: TestSourceSpan.at(1),
        sourceLanguage: ESourceLanguage.C,
        visibility: "public",
      });
      symbolTable.addTSymbol({
        ...TestSymbolUtils.base({
          kind: "function",
          name: "cnextFunction",
          scopePath: "",
          sourceFile: headerFile,
          span: TestSourceSpan.at(2),
        }),
        returnType: TTypeUtils.createPrimitive("void"),
        parameters: [],
        visibility: "public",
        body: null,
      } as IFunctionSymbol);

      cacheManager.setSymbolsFromTable(headerFile, symbolTable);

      const restored = readSymbols(
        cacheManager.getSymbols(headerFile)!.symbols,
      );
      expect(restored.map((symbol) => symbol.name)).toEqual(["cFunction"]);
    });

    it("should extract struct fields for structs defined in the file", async () => {
      const testFile = join(testDir, "structs.h");
      writeFileSync(testFile, "// test");

      // Add struct symbol to SymbolTable
      symbolTable.addCSymbol({
        name: "Point",
        kind: "struct",
        sourceFile: testFile,
        span: TestSourceSpan.at(1),
        sourceLanguage: ESourceLanguage.C,
        visibility: "public",
        isUnion: false,
      });

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
      symbolTable.addCSymbol({
        name: "PointA",
        kind: "struct",
        sourceFile: file1,
        span: TestSourceSpan.at(1),
        sourceLanguage: ESourceLanguage.C,
        visibility: "public",
        isUnion: false,
      });
      symbolTable.addStructField("PointA", "x", "int32_t");

      // Add struct in file2
      symbolTable.addCSymbol({
        name: "PointB",
        kind: "struct",
        sourceFile: file2,
        span: TestSourceSpan.at(1),
        sourceLanguage: ESourceLanguage.C,
        visibility: "public",
        isUnion: false,
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
      symbolTable.addCSymbol({
        name: "TypedefStruct",
        kind: "struct",
        sourceFile: testFile,
        span: TestSourceSpan.at(1),
        sourceLanguage: ESourceLanguage.C,
        visibility: "public",
        isUnion: false,
      });
      symbolTable.addCSymbol({
        name: "NamedStruct",
        kind: "struct",
        sourceFile: testFile,
        span: TestSourceSpan.at(5),
        sourceLanguage: ESourceLanguage.C,
        visibility: "public",
        isUnion: false,
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
      symbolTable.addCSymbol({
        name: "StructA",
        kind: "struct",
        sourceFile: file1,
        span: TestSourceSpan.at(1),
        sourceLanguage: ESourceLanguage.C,
        visibility: "public",
        isUnion: false,
      });
      symbolTable.addCSymbol({
        name: "StructB",
        kind: "struct",
        sourceFile: file2,
        span: TestSourceSpan.at(1),
        sourceLanguage: ESourceLanguage.C,
        visibility: "public",
        isUnion: false,
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
      const testFile = join(testDir, "enums.h");
      writeFileSync(testFile, "// test");

      // Add enum symbols
      symbolTable.addCSymbol({
        name: "Status",
        kind: "enum",
        sourceFile: testFile,
        span: TestSourceSpan.at(1),
        sourceLanguage: ESourceLanguage.C,
        visibility: "public",
        members: [],
      });
      symbolTable.addCSymbol({
        name: "Priority",
        kind: "enum",
        sourceFile: testFile,
        span: TestSourceSpan.at(5),
        sourceLanguage: ESourceLanguage.C,
        visibility: "public",
        members: [],
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
      symbolTable.addCSymbol({
        name: "EnumA",
        kind: "enum",
        sourceFile: file1,
        span: TestSourceSpan.at(1),
        sourceLanguage: ESourceLanguage.C,
        visibility: "public",
        members: [],
      });
      symbolTable.addCSymbol({
        name: "EnumB",
        kind: "enum",
        sourceFile: file2,
        span: TestSourceSpan.at(1),
        sourceLanguage: ESourceLanguage.C,
        visibility: "public",
        members: [],
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
      const testFile = join(testDir, "complete.h");
      writeFileSync(testFile, "// test");

      // Add function symbol
      symbolTable.addCSymbol({
        name: "processData",
        kind: "function",
        type: "void",
        sourceFile: testFile,
        span: TestSourceSpan.at(1),
        sourceLanguage: ESourceLanguage.C,
        visibility: "public",
      });

      // Add struct symbol and fields
      symbolTable.addCSymbol({
        name: "DataPacket",
        kind: "struct",
        sourceFile: testFile,
        span: TestSourceSpan.at(10),
        sourceLanguage: ESourceLanguage.C,
        visibility: "public",
        isUnion: false,
      });
      symbolTable.addStructField("DataPacket", "id", "uint32_t");
      symbolTable.addStructField("DataPacket", "buffer", "uint8_t", [256]);
      symbolTable.markNeedsStructKeyword("DataPacket");

      // Add enum symbol and bit width
      symbolTable.addCSymbol({
        name: "DataType",
        kind: "enum",
        sourceFile: testFile,
        span: TestSourceSpan.at(20),
        sourceLanguage: ESourceLanguage.C,
        visibility: "public",
        members: [],
      });
      symbolTable.addEnumBitWidth("DataType", 8);

      // Cache via setSymbolsFromTable
      cacheManager.setSymbolsFromTable(testFile, symbolTable);

      // Verify all data is cached correctly
      const cached = cacheManager.getSymbols(testFile);
      expect(cached).not.toBeNull();

      // Verify symbols
      expect(readSymbols(cached!.symbols)).toHaveLength(3);
      expect(
        readSymbols(cached!.symbols)
          .map((s) => s.name)
          .sort(),
      ).toEqual(["DataPacket", "DataType", "processData"]);

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
      const testFile = join(testDir, "persist.h");
      writeFileSync(testFile, "// test");

      // Add data to SymbolTable
      symbolTable.addCSymbol({
        name: "MyStruct",
        kind: "struct",
        sourceFile: testFile,
        span: TestSourceSpan.at(1),
        sourceLanguage: ESourceLanguage.C,
        visibility: "public",
        isUnion: false,
      });
      symbolTable.addStructField("MyStruct", "value", "int32_t");
      symbolTable.markNeedsStructKeyword("MyStruct");

      symbolTable.addCSymbol({
        name: "MyEnum",
        kind: "enum",
        sourceFile: testFile,
        span: TestSourceSpan.at(5),
        sourceLanguage: ESourceLanguage.C,
        visibility: "public",
        members: [],
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
      expect(readSymbols(cached!.symbols)).toHaveLength(2);
      expect(cached!.structFields.get("MyStruct")!.get("value")).toEqual({
        type: "int32_t",
      });
      expect(cached!.needsStructKeyword).toEqual(["MyStruct"]);
      expect(cached!.enumBitWidth.get("MyEnum")).toBe(16);
    });

    it("should not cache non-existent file", () => {
      const nonExistent = join(testDir, "does-not-exist.cnx");

      // Add symbol for non-existent file
      symbolTable.addCSymbol({
        name: "orphanFunc",
        kind: "function",
        type: "void",
        sourceFile: nonExistent,
        span: TestSourceSpan.at(1),
        sourceLanguage: ESourceLanguage.C,
        visibility: "public",
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
      expect(readSymbols(cached!.symbols)).toHaveLength(0);
      expect(cached!.structFields.size).toBe(0);
      expect(cached!.needsStructKeyword).toEqual([]);
      expect(cached!.enumBitWidth.size).toBe(0);
    });

    it("should handle structs without fields", async () => {
      const testFile = join(testDir, "emptystructs.h");
      writeFileSync(testFile, "// test");

      // Add struct symbol without adding any fields
      symbolTable.addCSymbol({
        name: "EmptyStruct",
        kind: "struct",
        sourceFile: testFile,
        span: TestSourceSpan.at(1),
        sourceLanguage: ESourceLanguage.C,
        visibility: "public",
        isUnion: false,
      });
      // Note: not adding fields, so getStructNamesByFile won't include it

      cacheManager.setSymbolsFromTable(testFile, symbolTable);

      const cached = cacheManager.getSymbols(testFile);
      expect(cached).not.toBeNull();
      // Symbol should be there
      expect(readSymbols(cached!.symbols)).toHaveLength(1);
      // But no struct fields (struct wasn't in getStructNamesByFile)
      expect(cached!.structFields.has("EmptyStruct")).toBe(false);
    });

    it("should handle enums without bit width", async () => {
      const testFile = join(testDir, "simpleenums.h");
      writeFileSync(testFile, "// test");

      // Add enum symbol without adding bit width
      symbolTable.addCSymbol({
        name: "SimpleEnum",
        kind: "enum",
        sourceFile: testFile,
        span: TestSourceSpan.at(1),
        sourceLanguage: ESourceLanguage.C,
        visibility: "public",
        members: [],
      });

      cacheManager.setSymbolsFromTable(testFile, symbolTable);

      const cached = cacheManager.getSymbols(testFile);
      expect(cached).not.toBeNull();
      expect(readSymbols(cached!.symbols)).toHaveLength(1);
      // Enum bit width should not be present
      expect(cached!.enumBitWidth.has("SimpleEnum")).toBe(false);
    });

    it("should handle multiple symbols of same kind", async () => {
      const testFile = join(testDir, "multifuncs.h");
      writeFileSync(testFile, "// test");

      // Add multiple functions
      symbolTable.addCSymbol({
        name: "func1",
        kind: "function",
        type: "void",
        sourceFile: testFile,
        span: TestSourceSpan.at(1),
        sourceLanguage: ESourceLanguage.C,
        visibility: "public",
      });
      symbolTable.addCSymbol({
        name: "func2",
        kind: "function",
        type: "void",
        sourceFile: testFile,
        span: TestSourceSpan.at(5),
        sourceLanguage: ESourceLanguage.C,
        visibility: "public",
      });
      symbolTable.addCSymbol({
        name: "func3",
        kind: "function",
        type: "void",
        sourceFile: testFile,
        span: TestSourceSpan.at(10),
        sourceLanguage: ESourceLanguage.C,
        visibility: "public",
      });

      cacheManager.setSymbolsFromTable(testFile, symbolTable);

      const cached = cacheManager.getSymbols(testFile);
      expect(cached).not.toBeNull();
      expect(readSymbols(cached!.symbols)).toHaveLength(3);
      expect(
        readSymbols(cached!.symbols)
          .map((s) => s.name)
          .sort(),
      ).toEqual(["func1", "func2", "func3"]);
    });
  });

  describe("with MockFileSystem (IFileSystem integration)", () => {
    // Note: CacheManager now uses flat-cache for symbol storage, which manages
    // its own file I/O. IFileSystem is used only for:
    // - Directory existence checks and creation
    // - Config file operations (read/write config.json)
    // - Cache key validation (via CacheKeyGenerator)
    //
    // Tests that depend on symbol cache file contents are skipped because
    // flat-cache writes directly to the real filesystem.

    let mockFs: MockFileSystem;
    let cacheManager: CacheManager;

    /**
     * Store symbols against THIS block's cacheManager.
     *
     * The outer storeSymbols closes over the outer manager, which this block
     * shadows -- calling it here writes to a different cache than the one
     * under test.
     */
    function storeMockSymbols(filePath: string, symbols: TCSymbol[]): void {
      cacheManager.setSymbols(
        filePath,
        symbols.map((symbol) => JsonCodec.encode(symbol)),
        new Map(),
        { structState: emptyStructState() },
      );
    }

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

    it("should store and retrieve symbols in memory (before flush)", async () => {
      await cacheManager.initialize();

      // Add a virtual test file
      mockFs.addFile("/project/test.h", "// test header");

      const symbol: TCSymbol = {
        name: "testFunc",
        kind: "function",
        type: "void",
        sourceFile: "/project/test.h",
        span: TestSourceSpan.at(1),
        sourceLanguage: ESourceLanguage.C,
        visibility: "public",
      };

      storeMockSymbols("/project/test.h", [symbol]);

      // Symbols are stored in flat-cache memory before flush
      const cached = cacheManager.getSymbols("/project/test.h");
      expect(cached).not.toBeNull();
      expect(readSymbols(cached!.symbols)).toHaveLength(1);
      expect(readSymbols(cached!.symbols)[0].name).toBe("testFunc");
    });

    it("should validate cache using mtime from IFileSystem", async () => {
      await cacheManager.initialize();

      // Add file with specific mtime
      mockFs.addFile("/project/test.h", "// test header", 1000);

      storeMockSymbols("/project/test.h", []);
      expect(cacheManager.isValid("/project/test.h")).toBe(true);

      // Change mtime to simulate file modification
      mockFs.setMtime("/project/test.h", 2000);
      expect(cacheManager.isValid("/project/test.h")).toBe(false);
    });

    it("should invalidate cache when version changes", async () => {
      // Pre-populate with old version config
      mockFs.addDirectory("/project/.cnx");
      mockFs.addDirectory("/project/.cnx/cache");

      const oldConfig = {
        version: 1, // Old version
        created: Date.now(),
        transpilerVersion: "0.0.1",
      };
      mockFs.addFile("/project/.cnx/config.json", JSON.stringify(oldConfig));

      await cacheManager.initialize();

      // Config should be updated with new version
      const content = mockFs.getWrittenContent("/project/.cnx/config.json");
      expect(content).toBeDefined();
      const newConfig = JSON.parse(content!);
      expect(newConfig.version).toBe(11); // Current CACHE_VERSION (Issue #1318)
    });

    it("should not cache files that do not exist in IFileSystem", async () => {
      await cacheManager.initialize();

      // Try to cache non-existent file
      storeMockSymbols("/project/nonexistent.h", [
        {
          name: "func",
          kind: "function",
          type: "void",
          sourceFile: "/project/nonexistent.h",
          span: TestSourceSpan.at(1),
          sourceLanguage: ESourceLanguage.C,
          visibility: "public",
        },
      ]);

      // Should not be cached (stat() will fail)
      const cached = cacheManager.getSymbols("/project/nonexistent.h");
      expect(cached).toBeNull();
    });
  });
});
