/**
 * Unit tests for SymbolTable
 * Issue #221: Function parameters should not cause conflicts
 * ADR-055 Phase 7: Fully typed symbol storage using TSymbol, TCSymbol, TCppSymbol
 */
import { describe, it, expect, beforeEach } from "vitest";
import SymbolTable from "../SymbolTable";
import ESourceLanguage from "../../../../utils/types/ESourceLanguage";
import TSymbol from "../../../types/symbols/TSymbol";
import IVariableSymbol from "../../../types/symbols/IVariableSymbol";
import IFunctionSymbol from "../../../types/symbols/IFunctionSymbol";
import IStructSymbol from "../../../types/symbols/IStructSymbol";
import IEnumSymbol from "../../../types/symbols/IEnumSymbol";
import ITargetCapabilities from "../../../types/ITargetCapabilities";
import TTypeUtils from "../../../../utils/TTypeUtils";
import TCSymbol from "../../../types/symbols/c/TCSymbol";
import TCppSymbol from "../../../types/symbols/cpp/TCppSymbol";
import TestSymbolUtils from "../cnext/__tests__/testSymbolUtils";

describe("SymbolTable", () => {
  let symbolTable: SymbolTable;

  beforeEach(() => {
    symbolTable = new SymbolTable();
  });

  // ========================================================================
  // TSymbol (C-Next) Operations
  // ========================================================================

  describe("addTSymbol and getTSymbol", () => {
    it("should add and retrieve a TSymbol by name", () => {
      const symbol: IVariableSymbol = {
        ...TestSymbolUtils.base({
          kind: "variable",
          name: "myVar",
          scopePath: "",
          sourceFile: "test.cnx",
          sourceLine: 1,
          sourceLanguage: ESourceLanguage.CNext,
          isExported: true,
        }),
        type: TTypeUtils.createPrimitive("u32"),
        isArray: false,
        isConst: false,
        isAtomic: false,
        isVolatile: false,
        overflowBehavior: "clamp",
      };

      symbolTable.addTSymbol(symbol);
      const retrieved = symbolTable.getTSymbol("myVar");

      expect(retrieved).toBeDefined();
      expect(retrieved?.name).toBe("myVar");
      expect(retrieved?.kind).toBe("variable");
    });

    it("should return undefined for non-existent symbol", () => {
      const retrieved = symbolTable.getTSymbol("nonExistent");
      expect(retrieved).toBeUndefined();
    });

    it("should return first symbol when multiple exist with same name", () => {
      symbolTable.addTSymbol({
        ...TestSymbolUtils.base({
          kind: "variable",
          name: "duplicate",
          scopePath: "",
          sourceFile: "first.cnx",
          sourceLine: 1,
          sourceLanguage: ESourceLanguage.CNext,
          isExported: true,
        }),
        type: TTypeUtils.createPrimitive("u32"),
        isArray: false,
        isConst: false,
        isAtomic: false,
        isVolatile: false,
        overflowBehavior: "clamp",
      });

      symbolTable.addTSymbol({
        ...TestSymbolUtils.base({
          kind: "variable",
          name: "duplicate",
          scopePath: "",
          sourceFile: "second.cnx",
          sourceLine: 5,
          sourceLanguage: ESourceLanguage.CNext,
          isExported: true,
        }),
        type: TTypeUtils.createPrimitive("u32"),
        isArray: false,
        isConst: false,
        isAtomic: false,
        isVolatile: false,
        overflowBehavior: "clamp",
      });

      const retrieved = symbolTable.getTSymbol("duplicate");
      expect(retrieved?.sourceFile).toBe("first.cnx");
    });
  });

  describe("addTSymbols", () => {
    it("should add multiple TSymbols at once", () => {
      const symbols: TSymbol[] = [
        {
          ...TestSymbolUtils.base({
            kind: "variable",
            name: "var1",
            scopePath: "",
            sourceFile: "test.cnx",
            sourceLine: 1,
            sourceLanguage: ESourceLanguage.CNext,
            isExported: true,
          }),
          type: TTypeUtils.createPrimitive("u32"),
          isArray: false,
          isConst: false,
          isAtomic: false,
          isVolatile: false,
          overflowBehavior: "clamp",
        },
        {
          ...TestSymbolUtils.base({
            kind: "variable",
            name: "var2",
            scopePath: "",
            sourceFile: "test.cnx",
            sourceLine: 2,
            sourceLanguage: ESourceLanguage.CNext,
            isExported: true,
          }),
          type: TTypeUtils.createPrimitive("i32"),
          isArray: false,
          isConst: false,
          isAtomic: false,
          isVolatile: false,
          overflowBehavior: "clamp",
        },
      ];

      symbolTable.addTSymbols(symbols);

      expect(symbolTable.getTSymbol("var1")).toBeDefined();
      expect(symbolTable.getTSymbol("var2")).toBeDefined();
    });
  });

  // ========================================================================
  // TCSymbol (C) Operations
  // ========================================================================

  describe("addCSymbol and getCSymbol", () => {
    it("should add and retrieve a C symbol", () => {
      const symbol: TCSymbol = {
        kind: "function",
        name: "c_function",
        sourceFile: "test.h",
        sourceLine: 10,
        sourceLanguage: ESourceLanguage.C,
        isExported: true,
        type: "int",
        parameters: [
          { name: "x", type: "int", isConst: false, isArray: false },
        ],
      };

      symbolTable.addCSymbol(symbol);
      const retrieved = symbolTable.getCSymbol("c_function");

      expect(retrieved).toBeDefined();
      expect(retrieved?.name).toBe("c_function");
      expect(retrieved?.kind).toBe("function");
      expect(retrieved?.sourceLanguage).toBe(ESourceLanguage.C);
    });
  });

  // ========================================================================
  // TCppSymbol (C++) Operations
  // ========================================================================

  describe("addCppSymbol and getCppSymbol", () => {
    it("should add and retrieve a C++ symbol", () => {
      const symbol: TCppSymbol = {
        kind: "class",
        name: "MyClass",
        sourceFile: "test.hpp",
        sourceLine: 5,
        sourceLanguage: ESourceLanguage.Cpp,
        isExported: true,
      };

      symbolTable.addCppSymbol(symbol);
      const retrieved = symbolTable.getCppSymbol("MyClass");

      expect(retrieved).toBeDefined();
      expect(retrieved?.name).toBe("MyClass");
      expect(retrieved?.kind).toBe("class");
      expect(retrieved?.sourceLanguage).toBe(ESourceLanguage.Cpp);
    });
  });

  // ========================================================================
  // Cross-Language Operations
  // ========================================================================

  describe("getAllSymbols", () => {
    it("should return symbols from all languages", () => {
      symbolTable.addTSymbol({
        ...TestSymbolUtils.base({
          kind: "variable",
          name: "cnextVar",
          scopePath: "",
          sourceFile: "test.cnx",
          sourceLine: 1,
          sourceLanguage: ESourceLanguage.CNext,
          isExported: true,
        }),
        type: TTypeUtils.createPrimitive("u32"),
        isArray: false,
        isConst: false,
        isAtomic: false,
        isVolatile: false,
        overflowBehavior: "clamp",
      });

      symbolTable.addCSymbol({
        kind: "variable",
        name: "cVar",
        sourceFile: "test.h",
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.C,
        isExported: true,
        type: "int",
      });

      symbolTable.addCppSymbol({
        kind: "variable",
        name: "cppVar",
        sourceFile: "test.hpp",
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.Cpp,
        isExported: true,
        type: "int",
      });

      const all = symbolTable.getAllSymbols();
      expect(all).toHaveLength(3);
    });
  });

  describe("getOverloads", () => {
    it("should return overloads from all languages", () => {
      symbolTable.addTSymbol({
        ...TestSymbolUtils.base({
          kind: "function",
          name: "process",
          scopePath: "",
          sourceFile: "test.cnx",
          sourceLine: 1,
          sourceLanguage: ESourceLanguage.CNext,
          isExported: true,
        }),
        returnType: TTypeUtils.createPrimitive("void"),
        parameters: [],
        visibility: "public",
        body: null,
      } as IFunctionSymbol);

      symbolTable.addCppSymbol({
        kind: "function",
        name: "process",
        sourceFile: "test.hpp",
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.Cpp,
        isExported: true,
        type: "void",
        parameters: [
          { name: "x", type: "int", isConst: false, isArray: false },
        ],
      });

      const overloads = symbolTable.getOverloads("process");
      expect(overloads).toHaveLength(2);
    });
  });

  // ========================================================================
  // Conflict Detection
  // ========================================================================

  describe("hasConflict", () => {
    it("should detect cross-language conflicts between C-Next and C", () => {
      symbolTable.addTSymbol({
        ...TestSymbolUtils.base({
          kind: "function",
          name: "conflictFunc",
          scopePath: "",
          sourceFile: "test.cnx",
          sourceLine: 1,
          sourceLanguage: ESourceLanguage.CNext,
          isExported: true,
        }),
        returnType: TTypeUtils.createPrimitive("void"),
        parameters: [],
        visibility: "public",
        body: null,
      } as IFunctionSymbol);

      symbolTable.addCSymbol({
        kind: "function",
        name: "conflictFunc",
        sourceFile: "test.h",
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.C,
        isExported: true,
        type: "void",
        parameters: [],
      });

      expect(symbolTable.hasConflict("conflictFunc")).toBe(true);
    });

    it("should not detect conflict for C++ function overloads with different signatures", () => {
      symbolTable.addCppSymbol({
        kind: "function",
        name: "overloaded",
        sourceFile: "test.hpp",
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.Cpp,
        isExported: true,
        type: "void",
        parameters: [],
      });

      symbolTable.addCppSymbol({
        kind: "function",
        name: "overloaded",
        sourceFile: "test.hpp",
        sourceLine: 5,
        sourceLanguage: ESourceLanguage.Cpp,
        isExported: true,
        type: "void",
        parameters: [
          { name: "x", type: "int", isConst: false, isArray: false },
        ],
      });

      expect(symbolTable.hasConflict("overloaded")).toBe(false);
    });

    // The same symbol declared in both a C header and a C++ header is normally the
    // SAME symbol seen twice, not a conflict. Covered here because extracting
    // detectCNextDuplicate moved this branch, and a moved line is attributed to
    // the mover.
    it("should NOT detect conflict for the same symbol in C and C++ headers", () => {
      symbolTable.addCSymbol({
        kind: "function",
        name: "shared_api",
        sourceFile: "api.h",
        sourceLine: 3,
        sourceLanguage: ESourceLanguage.C,
        isExported: true,
        type: "int",
        parameters: [],
      });

      symbolTable.addCppSymbol({
        kind: "function",
        name: "shared_api",
        sourceFile: "api.hpp",
        sourceLine: 4,
        sourceLanguage: ESourceLanguage.Cpp,
        isExported: true,
        type: "int",
        parameters: [],
      } as unknown as TCppSymbol);

      expect(symbolTable.hasConflict("shared_api")).toBe(false);
    });

    // Issue #1333: a scope may be REOPENED. Two `scope Lib` declarations are the
    // same scope gaining members, not two definitions of one name.
    //
    // The integration fixtures under tests/bugs/issue-1333-scope-reopening/ cover
    // the behavior end-to-end, but they do not feed the coverage metric, so the
    // `continue` implementing this rule measured 0 hits on new code. This is the
    // unit-level seam for it.
    it("should NOT detect conflict for a scope declared twice (reopened)", () => {
      for (const line of [1, 10]) {
        symbolTable.addTSymbol({
          ...TestSymbolUtils.base({
            kind: "scope",
            name: "Lib",
            scopePath: "",
            sourceFile: "test.cnx",
            sourceLine: line,
            sourceLanguage: ESourceLanguage.CNext,
            isExported: true,
          }),
          members: [],
        } as unknown as TSymbol);
      }

      expect(symbolTable.hasConflict("Lib")).toBe(false);
    });

    // The negative control: reopening composes a scope, it does not relax member
    // uniqueness. Two definitions of the same member collide whichever block they
    // were written in, because members group by the scope's own identity.
    it("should STILL detect conflict for a duplicated member of a reopened scope", () => {
      for (const line of [2, 11]) {
        symbolTable.addTSymbol({
          ...TestSymbolUtils.base({
            kind: "variable",
            name: "count",
            scopePath: "Lib",
            sourceFile: "test.cnx",
            sourceLine: line,
            sourceLanguage: ESourceLanguage.CNext,
            isExported: true,
          }),
          type: TTypeUtils.createPrimitive("u32"),
          isArray: false,
          isConst: false,
          isAtomic: false,
          isVolatile: false,
          overflowBehavior: "clamp",
        });
      }

      expect(symbolTable.hasConflict("count")).toBe(true);
    });

    // Issue #817: Scope-private members should NOT conflict across scopes
    it("should NOT detect conflict for same-named members in different scopes", () => {
      // Create two different named scopes

      // Add 'enabled' variable in scope Foo
      symbolTable.addTSymbol({
        ...TestSymbolUtils.base({
          kind: "variable",
          name: "enabled",
          scopePath: "Foo",
          sourceFile: "test.cnx",
          sourceLine: 2,
          sourceLanguage: ESourceLanguage.CNext,
          isExported: false,
        }),
        type: TTypeUtils.createPrimitive("bool"),
        isArray: false,
        isConst: false,
        isAtomic: false,
        isVolatile: false,
        overflowBehavior: "clamp",
      });

      // Add 'enabled' variable in scope Bar
      symbolTable.addTSymbol({
        ...TestSymbolUtils.base({
          kind: "variable",
          name: "enabled",
          scopePath: "Bar",
          sourceFile: "test.cnx",
          sourceLine: 10,
          sourceLanguage: ESourceLanguage.CNext,
          isExported: false,
        }),
        type: TTypeUtils.createPrimitive("bool"),
        isArray: false,
        isConst: false,
        isAtomic: false,
        isVolatile: false,
        overflowBehavior: "clamp",
      });

      // These are NOT conflicts - they generate Foo_enabled and Bar_enabled
      expect(symbolTable.hasConflict("enabled")).toBe(false);
    });

    // Issue #817: Same-named functions in different scopes are not conflicts
    it("should NOT detect conflict for same-named functions in different scopes", () => {
      // Add 'initialize' function in scope Foo
      symbolTable.addTSymbol({
        ...TestSymbolUtils.base({
          kind: "function",
          name: "initialize",
          scopePath: "Foo",
          sourceFile: "test.cnx",
          sourceLine: 4,
          sourceLanguage: ESourceLanguage.CNext,
          isExported: true,
        }),
        returnType: TTypeUtils.createPrimitive("void"),
        parameters: [],
        visibility: "public",
        body: null,
      } as IFunctionSymbol);

      // Add 'initialize' function in scope Bar
      symbolTable.addTSymbol({
        ...TestSymbolUtils.base({
          kind: "function",
          name: "initialize",
          scopePath: "Bar",
          sourceFile: "test.cnx",
          sourceLine: 12,
          sourceLanguage: ESourceLanguage.CNext,
          isExported: true,
        }),
        returnType: TTypeUtils.createPrimitive("void"),
        parameters: [],
        visibility: "public",
        body: null,
      } as IFunctionSymbol);

      // These generate Foo_initialize and Bar_initialize - no conflict
      expect(symbolTable.hasConflict("initialize")).toBe(false);
    });

    // True conflicts: same name in same scope should still be detected
    it("should detect conflict for same-named symbols in same scope", () => {
      // Add 'duplicate' variable in scope Foo twice
      symbolTable.addTSymbol({
        ...TestSymbolUtils.base({
          kind: "variable",
          name: "duplicate",
          scopePath: "Foo",
          sourceFile: "test.cnx",
          sourceLine: 2,
          sourceLanguage: ESourceLanguage.CNext,
          isExported: false,
        }),
        type: TTypeUtils.createPrimitive("bool"),
        isArray: false,
        isConst: false,
        isAtomic: false,
        isVolatile: false,
        overflowBehavior: "clamp",
      });

      symbolTable.addTSymbol({
        ...TestSymbolUtils.base({
          kind: "variable",
          name: "duplicate",
          scopePath: "Foo",
          sourceFile: "test.cnx",
          sourceLine: 5,
          sourceLanguage: ESourceLanguage.CNext,
          isExported: false,
        }),
        type: TTypeUtils.createPrimitive("bool"),
        isArray: false,
        isConst: false,
        isAtomic: false,
        isVolatile: false,
        overflowBehavior: "clamp",
      });

      // Same name in SAME scope IS a conflict
      expect(symbolTable.hasConflict("duplicate")).toBe(true);
    });

    // #1285: the conflict grouping key must be the scope's IDENTITY, not its
    // leaf name. Two distinct scopes can share a leaf, and the #817 tests above
    // cannot see the difference because they use depth-one scopes, where a
    // scope's name and its qualified name are the same string.
    //
    // Nested scopes are unreachable from .cnx source (grammar/CNext.g4:81-89),
    // so this has to be built through the scope factory. That is the point: the
    // property is real in the symbol model before the grammar admits it.
    it("should NOT detect conflict for members of distinct scopes sharing a leaf name", () => {
      // Outer.Inner.tick and Other.Inner.tick -- different symbols, and they
      // generate different C names, so they do not compete.
      for (const [scopePath, line] of [
        ["Outer.Inner", 2],
        ["Other.Inner", 20],
      ] as const) {
        symbolTable.addTSymbol({
          ...TestSymbolUtils.base({
            kind: "variable",
            name: "tick",
            scopePath,
            sourceFile: "test.cnx",
            sourceLine: line,
            isExported: false,
          }),
          type: TTypeUtils.createPrimitive("u32"),
          isArray: false,
          isConst: false,
          isAtomic: false,
          isVolatile: false,
          overflowBehavior: "clamp",
        });
      }

      // Keying on the leaf groups both under "Inner:variable" and reports a
      // conflict between symbols that never shared a scope.
      expect(symbolTable.hasConflict("tick")).toBe(false);
    });

    // #1285: the conflict message must name the symbol the way the author wrote
    // it. Nothing asserted this, so dropping the scope from the message entirely
    // left the whole suite green.
    it("names a conflicting symbol by its full source path", () => {
      for (const line of [2, 5]) {
        symbolTable.addTSymbol({
          ...TestSymbolUtils.base({
            kind: "variable",
            name: "tick",
            scopePath: "Outer.Inner",
            sourceFile: "test.cnx",
            sourceLine: line,
            isExported: false,
          }),
          type: TTypeUtils.createPrimitive("u32"),
          isArray: false,
          isConst: false,
          isAtomic: false,
          isVolatile: false,
          overflowBehavior: "clamp",
        });
      }

      const conflicts = symbolTable.getConflicts();

      expect(conflicts).toHaveLength(1);
      // Not "tick" (no scope at all) and not "Inner.tick" (the leaf only, which
      // is what building this by hand from scope.name produced).
      expect(conflicts[0].symbolName).toBe("Outer.Inner.tick");
    });

    // Global scope conflicts should still be detected
    it("should detect conflict for same-named globals", () => {
      // Add two global variables with same name
      symbolTable.addTSymbol({
        ...TestSymbolUtils.base({
          kind: "variable",
          name: "globalVar",
          scopePath: "",
          sourceFile: "first.cnx",
          sourceLine: 1,
          sourceLanguage: ESourceLanguage.CNext,
          isExported: true,
        }),
        type: TTypeUtils.createPrimitive("u32"),
        isArray: false,
        isConst: false,
        isAtomic: false,
        isVolatile: false,
        overflowBehavior: "clamp",
      });

      symbolTable.addTSymbol({
        ...TestSymbolUtils.base({
          kind: "variable",
          name: "globalVar",
          scopePath: "",
          sourceFile: "second.cnx",
          sourceLine: 1,
          sourceLanguage: ESourceLanguage.CNext,
          isExported: true,
        }),
        type: TTypeUtils.createPrimitive("u32"),
        isArray: false,
        isConst: false,
        isAtomic: false,
        isVolatile: false,
        overflowBehavior: "clamp",
      });

      // Two globals with same name IS a conflict
      expect(symbolTable.hasConflict("globalVar")).toBe(true);
    });

    // Issue #967: Scoped C-Next symbols live in a namespace and don't conflict
    // with C's global symbols. Only global-scope C-Next symbols can conflict.
    it("should NOT detect conflict for scoped C-Next method vs C function with same bare name", () => {
      // Add C-Next scoped function 'read' in scope 'Touch'
      // This transpiles to Touch_read()
      symbolTable.addTSymbol({
        ...TestSymbolUtils.base({
          kind: "function",
          name: "read",
          scopePath: "Touch",
          sourceFile: "touch.cnx",
          sourceLine: 28,
          sourceLanguage: ESourceLanguage.CNext,
          isExported: true,
        }),
        returnType: TTypeUtils.createPrimitive("u8"),
        parameters: [],
        visibility: "public",
        body: null,
      } as IFunctionSymbol);

      // Add C function 'read' from POSIX headers
      // This stays as read()
      symbolTable.addCSymbol({
        kind: "function",
        name: "read",
        sourceFile: "lv_pthread.h",
        sourceLine: 80,
        sourceLanguage: ESourceLanguage.C,
        isExported: true,
        type: "ssize_t",
        parameters: [
          { name: "fd", type: "int", isConst: false, isArray: false },
          { name: "buf", type: "void*", isConst: false, isArray: false },
          { name: "count", type: "size_t", isConst: false, isArray: false },
        ],
      });

      // Touch.read() is in a namespace — does NOT conflict with C's global read()
      expect(symbolTable.hasConflict("read")).toBe(false);
    });

    // Issue #967: Global C-Next functions SHOULD still conflict with C functions
    it("should detect conflict for global C-Next function vs C function", () => {
      // Add global C-Next function 'read'
      symbolTable.addTSymbol({
        ...TestSymbolUtils.base({
          kind: "function",
          name: "read",
          scopePath: "",
          sourceFile: "utils.cnx",
          sourceLine: 5,
          sourceLanguage: ESourceLanguage.CNext,
          isExported: true,
        }),
        returnType: TTypeUtils.createPrimitive("u8"),
        parameters: [],
        visibility: "public",
        body: null,
      } as IFunctionSymbol);

      // Add C function 'read'
      symbolTable.addCSymbol({
        kind: "function",
        name: "read",
        sourceFile: "unistd.h",
        sourceLine: 100,
        sourceLanguage: ESourceLanguage.C,
        isExported: true,
        type: "ssize_t",
        parameters: [],
      });

      // Global C-Next read() DOES conflict with C's read()
      expect(symbolTable.hasConflict("read")).toBe(true);
    });
  });

  // ========================================================================
  // Type-Safe Symbol Queries
  // ========================================================================

  describe("type-safe queries", () => {
    it("getStructSymbols should return only struct symbols", () => {
      symbolTable.addTSymbol({
        ...TestSymbolUtils.base({
          kind: "struct",
          name: "MyStruct",
          scopePath: "",
          sourceFile: "test.cnx",
          sourceLine: 1,
          sourceLanguage: ESourceLanguage.CNext,
          isExported: true,
        }),
        fields: new Map(),
      } as IStructSymbol);

      symbolTable.addTSymbol({
        ...TestSymbolUtils.base({
          kind: "variable",
          name: "myVar",
          scopePath: "",
          sourceFile: "test.cnx",
          sourceLine: 2,
          sourceLanguage: ESourceLanguage.CNext,
          isExported: true,
        }),
        type: TTypeUtils.createPrimitive("u32"),
        isArray: false,
        isConst: false,
        isAtomic: false,
        isVolatile: false,
        overflowBehavior: "clamp",
      });

      const structs = symbolTable.getStructSymbols();
      expect(structs).toHaveLength(1);
      expect(structs[0].name).toBe("MyStruct");
    });

    it("getEnumSymbols should return only enum symbols", () => {
      symbolTable.addTSymbol({
        ...TestSymbolUtils.base({
          kind: "enum",
          name: "MyEnum",
          scopePath: "",
          sourceFile: "test.cnx",
          sourceLine: 1,
          sourceLanguage: ESourceLanguage.CNext,
          isExported: true,
        }),
        members: new Map([["VALUE1", 0]]),
      } as IEnumSymbol);

      const enums = symbolTable.getEnumSymbols();
      expect(enums).toHaveLength(1);
      expect(enums[0].name).toBe("MyEnum");
    });

    it("getFunctionSymbols should return only function symbols", () => {
      symbolTable.addTSymbol({
        ...TestSymbolUtils.base({
          kind: "function",
          name: "myFunc",
          scopePath: "",
          sourceFile: "test.cnx",
          sourceLine: 1,
          sourceLanguage: ESourceLanguage.CNext,
          isExported: true,
        }),
        returnType: TTypeUtils.createPrimitive("void"),
        parameters: [],
        visibility: "public",
        body: null,
      } as IFunctionSymbol);

      const functions = symbolTable.getFunctionSymbols();
      expect(functions).toHaveLength(1);
      expect(functions[0].name).toBe("myFunc");
    });
  });

  // ========================================================================
  // Struct Field Information
  // ========================================================================

  describe("struct fields", () => {
    it("should add and retrieve struct field information", () => {
      symbolTable.addStructField("Point", "x", "int");
      symbolTable.addStructField("Point", "y", "int");

      expect(symbolTable.getStructFieldType("Point", "x")).toBe("int");
      expect(symbolTable.getStructFieldType("Point", "y")).toBe("int");
    });

    it("should return undefined for non-existent struct or field", () => {
      expect(
        symbolTable.getStructFieldType("NonExistent", "x"),
      ).toBeUndefined();
    });

    it("should get all fields for a struct", () => {
      symbolTable.addStructField("Point", "x", "int");
      symbolTable.addStructField("Point", "y", "int");

      const fields = symbolTable.getStructFields("Point");
      expect(fields?.size).toBe(2);
    });

    it("Issue #981: addCSymbol should register struct fields with macro dimensions", () => {
      // When a C struct with macro-sized array fields is added via addCSymbol,
      // the fields should be registered in structFields for getMemberTypeInfo lookups
      const cStructSymbol: TCSymbol = {
        kind: "struct",
        name: "msg_t",
        sourceFile: "fake_lib.h",
        sourceLine: 5,
        sourceLanguage: ESourceLanguage.C,
        isExported: true,
        isUnion: false,
        fields: new Map([
          [
            "data",
            { name: "data", type: "uint8_t", arrayDimensions: ["BUF_SIZE"] },
          ],
        ]),
      };

      symbolTable.addCSymbol(cStructSymbol);

      // Struct fields should now be registered
      const fields = symbolTable.getStructFields("msg_t");
      expect(fields).toBeDefined();
      expect(fields?.size).toBe(1);

      // Field info should include the macro-sized array dimension
      const dataField = symbolTable.getStructFieldInfo("msg_t", "data");
      expect(dataField).toBeDefined();
      expect(dataField?.type).toBe("uint8_t");
      expect(dataField?.arrayDimensions).toEqual(["BUF_SIZE"]);
    });
  });

  // ========================================================================
  // Needs Struct Keyword Tracking
  // ========================================================================

  describe("needsStructKeyword", () => {
    it("should track structs requiring struct keyword", () => {
      symbolTable.markNeedsStructKeyword("RawStruct");

      expect(symbolTable.checkNeedsStructKeyword("RawStruct")).toBe(true);
      expect(symbolTable.checkNeedsStructKeyword("OtherStruct")).toBe(false);
    });
  });

  // ========================================================================
  // Enum Bit Width Tracking
  // ========================================================================

  describe("enumBitWidth", () => {
    it("should track enum bit widths", () => {
      symbolTable.addEnumBitWidth("SmallEnum", 8);
      symbolTable.addEnumBitWidth("LargeEnum", 32);

      expect(symbolTable.getEnumBitWidth("SmallEnum")).toBe(8);
      expect(symbolTable.getEnumBitWidth("LargeEnum")).toBe(32);
      expect(symbolTable.getEnumBitWidth("UnknownEnum")).toBeUndefined();
    });
  });

  // ========================================================================
  // Opaque Type Tracking (Issue #948)
  // ========================================================================

  describe("Opaque Type Tracking", () => {
    it("should mark and check opaque types", () => {
      symbolTable.markOpaqueType("widget_t");
      expect(symbolTable.isOpaqueType("widget_t")).toBe(true);
      expect(symbolTable.isOpaqueType("other_t")).toBe(false);
    });

    it("should resolve opaque type as non-opaque when struct tag has body", () => {
      // typedef struct _point point_t; → mark opaque + register alias
      symbolTable.markOpaqueType("point_t");
      symbolTable.registerStructTagAlias("_point", "point_t");
      expect(symbolTable.isOpaqueType("point_t")).toBe(true);

      // struct _point { int x; int y; }; → mark body
      symbolTable.markStructTagHasBody("_point");
      // Query-time resolution: no longer opaque
      expect(symbolTable.isOpaqueType("point_t")).toBe(false);
    });

    it("should keep opaque type when no body found for struct tag", () => {
      symbolTable.markOpaqueType("handle_t");
      symbolTable.registerStructTagAlias("_handle", "handle_t");
      // No markStructTagHasBody call → stays opaque
      expect(symbolTable.isOpaqueType("handle_t")).toBe(true);
    });

    it("should get all opaque types", () => {
      symbolTable.markOpaqueType("handle_t");
      symbolTable.markOpaqueType("context_t");
      const all = symbolTable.getAllOpaqueTypes();
      expect(all).toContain("handle_t");
      expect(all).toContain("context_t");
      expect(all).toHaveLength(2);
    });

    it("should clear opaque types on clear()", () => {
      symbolTable.markOpaqueType("widget_t");
      symbolTable.clear();
      expect(symbolTable.isOpaqueType("widget_t")).toBe(false);
    });

    it("should restore opaque types from cache", () => {
      // Issue #1225: round-trip through the real serializer rather than a
      // hand-built payload -- a payload the production path never writes can
      // pass while the production path is broken.
      const source = new SymbolTable();
      source.markOpaqueType("widget_t");
      source.markOpaqueType("handle_t");

      symbolTable.restoreStructState(source.serializeStructState());

      expect(symbolTable.isOpaqueType("widget_t")).toBe(true);
      expect(symbolTable.isOpaqueType("handle_t")).toBe(true);
      expect(symbolTable.getAllOpaqueTypes()).toHaveLength(2);
    });

    it("clearStructTagHasBody restores opacity for a phantom body (#985)", () => {
      symbolTable.markOpaqueType("obj_t");
      symbolTable.registerStructTagAlias("_obj", "obj_t");
      symbolTable.markStructTagHasBody("_obj"); // phantom body from a blob parse
      expect(symbolTable.isOpaqueType("obj_t")).toBe(false);

      symbolTable.clearStructTagHasBody("_obj");
      expect(symbolTable.isOpaqueType("obj_t")).toBe(true);
      expect(symbolTable.getAllStructTagsWithBodies()).not.toContain("_obj");
    });

    it("clearStructTagHasBody is a no-op when the tag has no body", () => {
      // Must not throw or spuriously mutate when the tag was never marked.
      expect(() => symbolTable.clearStructTagHasBody("_never")).not.toThrow();
      expect(symbolTable.getAllStructTagsWithBodies()).not.toContain("_never");
    });

    it("getStructTagForTypedef returns the aliased tag or undefined", () => {
      symbolTable.registerStructTagAlias("_lv_obj_t", "lv_obj_t");
      expect(symbolTable.getStructTagForTypedef("lv_obj_t")).toBe("_lv_obj_t");
      expect(symbolTable.getStructTagForTypedef("unknown_t")).toBeUndefined();
    });
  });

  // ========================================================================
  // External Declaration Names (Issue #985 macro recovery)
  // ========================================================================

  describe("External Declaration Names", () => {
    it("registers and looks up recovered function-like macro names", () => {
      expect(symbolTable.hasExternalDeclaration("pdMS_TO_TICKS")).toBe(false);
      symbolTable.addExternalDeclarationNames(
        new Set(["pdMS_TO_TICKS", "portTICK_PERIOD_MS"]),
      );
      expect(symbolTable.hasExternalDeclaration("pdMS_TO_TICKS")).toBe(true);
      expect(symbolTable.hasExternalDeclaration("portTICK_PERIOD_MS")).toBe(
        true,
      );
      expect(symbolTable.hasExternalDeclaration("not_recovered")).toBe(false);
    });

    it("accumulates across calls and tolerates an empty set", () => {
      symbolTable.addExternalDeclarationNames(new Set(["A"]));
      symbolTable.addExternalDeclarationNames(new Set());
      symbolTable.addExternalDeclarationNames(new Set(["B"]));
      expect(symbolTable.hasExternalDeclaration("A")).toBe(true);
      expect(symbolTable.hasExternalDeclaration("B")).toBe(true);
    });
  });

  // ========================================================================
  // Typedef Struct Type Tracking (Issue #958)
  // ========================================================================

  describe("Typedef Struct Type Tracking", () => {
    it("should mark and check typedef struct types", () => {
      symbolTable.markTypedefStructType("widget_t", "widget_types.h");
      expect(symbolTable.isTypedefStructType("widget_t")).toBe(true);
      expect(symbolTable.isTypedefStructType("other_t")).toBe(false);
    });

    it("should return false when underlying struct tag has body (issue #948)", () => {
      // Issue #948: Query-time resolution - if the underlying struct tag
      // has a full body definition, this is NOT an external typedef struct
      symbolTable.markTypedefStructType("point_t", "point.h");
      expect(symbolTable.isTypedefStructType("point_t")).toBe(true);
      // After marking the body, typedef struct type should return false
      // because it's now a complete type (value semantics, not pointer)
      symbolTable.registerStructTagAlias("_point", "point_t");
      symbolTable.markStructTagHasBody("_point");
      expect(symbolTable.isTypedefStructType("point_t")).toBe(false);
    });

    it("should get all typedef struct types", () => {
      symbolTable.markTypedefStructType("handle_t", "handle.h");
      symbolTable.markTypedefStructType("context_t", "context.h");
      const all = symbolTable.getAllTypedefStructTypes();
      expect(all).toHaveLength(2);
      expect(all).toContainEqual(["handle_t", "handle.h"]);
      expect(all).toContainEqual(["context_t", "context.h"]);
    });

    it("should clear typedef struct types on clear()", () => {
      symbolTable.markTypedefStructType("widget_t", "widget.h");
      symbolTable.clear();
      expect(symbolTable.isTypedefStructType("widget_t")).toBe(false);
    });

    it("should restore typedef struct types from cache", () => {
      const source = new SymbolTable();
      source.markTypedefStructType("widget_t", "widget_types.h");
      source.markTypedefStructType("handle_t", "handle.h");

      symbolTable.restoreStructState(source.serializeStructState());

      expect(symbolTable.isTypedefStructType("widget_t")).toBe(true);
      expect(symbolTable.isTypedefStructType("handle_t")).toBe(true);
      expect(symbolTable.getAllTypedefStructTypes()).toHaveLength(2);
    });
  });

  // ========================================================================
  // Struct Tag Aliases and Body Tracking (Issue #958)
  // ========================================================================

  describe("Struct Tag Aliases and Body Tracking", () => {
    it("should register and retrieve struct tag aliases", () => {
      symbolTable.registerStructTagAlias("_widget", "widget_t");
      expect(symbolTable.getStructTagAlias("_widget")).toBe("widget_t");
      expect(symbolTable.getStructTagAlias("_unknown")).toBeUndefined();
    });

    it("should populate forward and reverse alias maps", () => {
      symbolTable.registerStructTagAlias("_foo", "foo_t");
      const aliases = symbolTable.getAllStructTagAliases();
      expect(aliases).toContainEqual(["_foo", "foo_t"]);
    });

    it("should track struct tags with bodies", () => {
      symbolTable.markStructTagHasBody("_widget");
      const bodies = symbolTable.getAllStructTagsWithBodies();
      expect(bodies).toContain("_widget");
    });

    it("should restore struct tag aliases from cache", () => {
      const source = new SymbolTable();
      source.registerStructTagAlias("_foo", "foo_t");
      source.registerStructTagAlias("_bar", "bar_t");

      symbolTable.restoreStructState(source.serializeStructState());

      expect(symbolTable.getStructTagAlias("_foo")).toBe("foo_t");
      expect(symbolTable.getStructTagAlias("_bar")).toBe("bar_t");
    });

    it("should restore reverse map (typedefToTag) so isOpaqueType resolves after cache restore", () => {
      const opaque = new SymbolTable();
      opaque.registerStructTagAlias("_widget", "widget_t");
      opaque.markOpaqueType("widget_t");

      symbolTable.restoreStructState(opaque.serializeStructState());

      // widget_t is opaque (no body for _widget)
      expect(symbolTable.isOpaqueType("widget_t")).toBe(true);

      // Now restore a body — isOpaqueType resolves via typedefToTag, which
      // only works because serializeStructState captures that map too.
      const withBody = new SymbolTable();
      withBody.markStructTagHasBody("_widget");
      symbolTable.restoreStructState(withBody.serializeStructState());

      expect(symbolTable.isOpaqueType("widget_t")).toBe(false);
    });

    it("should restore struct tags with bodies from cache", () => {
      const source = new SymbolTable();
      source.markStructTagHasBody("_foo");
      source.markStructTagHasBody("_bar");

      symbolTable.restoreStructState(source.serializeStructState());

      const bodies = symbolTable.getAllStructTagsWithBodies();
      expect(bodies).toContain("_foo");
      expect(bodies).toContain("_bar");
    });

    it("carries pointer typedefs across the cache round trip (#1225)", () => {
      // #1164 recorded `typedef struct opaque_t* handle_t` in structState and
      // nothing captured it, so a warm-cache build forgot that handle_t is a
      // pointer and forward-declared it as an incomplete struct -- a different
      // type, in a header that cannot compile.
      const source = new SymbolTable();
      source.markPointerTypedef("handle_t");

      symbolTable.restoreStructState(source.serializeStructState());

      expect(symbolTable.isPointerTypedef("handle_t")).toBe(true);
    });

    it("should clear all struct state on clear()", () => {
      symbolTable.registerStructTagAlias("_foo", "foo_t");
      symbolTable.markStructTagHasBody("_foo");
      symbolTable.clear();
      expect(symbolTable.getStructTagAlias("_foo")).toBeUndefined();
      expect(symbolTable.getAllStructTagsWithBodies()).toHaveLength(0);
    });
  });

  // ========================================================================
  // Clear
  // ========================================================================

  describe("clear", () => {
    it("should clear all symbols", () => {
      symbolTable.addTSymbol({
        ...TestSymbolUtils.base({
          kind: "variable",
          name: "test",
          scopePath: "",
          sourceFile: "test.cnx",
          sourceLine: 1,
          sourceLanguage: ESourceLanguage.CNext,
          isExported: true,
        }),
        type: TTypeUtils.createPrimitive("u32"),
        isArray: false,
        isConst: false,
        isAtomic: false,
        isVolatile: false,
        overflowBehavior: "clamp",
      });

      symbolTable.addStructField("Point", "x", "int");
      symbolTable.markNeedsStructKeyword("RawStruct");
      symbolTable.markOpaqueType("widget_t");
      symbolTable.addEnumBitWidth("SmallEnum", 8);
      symbolTable.markTypedefStructType("handle_t", "handle.h");

      symbolTable.clear();

      expect(symbolTable.getAllSymbols()).toHaveLength(0);
      expect(symbolTable.getStructFieldType("Point", "x")).toBeUndefined();
      expect(symbolTable.checkNeedsStructKeyword("RawStruct")).toBe(false);
      expect(symbolTable.isOpaqueType("widget_t")).toBe(false);
      expect(symbolTable.getEnumBitWidth("SmallEnum")).toBeUndefined();
      expect(symbolTable.isTypedefStructType("handle_t")).toBe(false);
    });
  });

  // ========================================================================
  // MISRA C:2012 Rule 5.1 - External Identifier Length (issue #1307)
  // ========================================================================

  describe("detectMISRA51Conflicts", () => {
    const LONG_SCOPE = "TemperatureSensorController";

    const targetCaps: ITargetCapabilities = {
      wordSize: 32,
      hasLdrexStrex: false,
      hasBasepri: false,
      significantExternalIdentifierChars: 31,
      significantInternalIdentifierChars: 63,
    };

    /** A scope member variable, public unless told otherwise. */
    function scopeVariable(
      name: string,
      line: number,
      isExported = true,
      scopeName = LONG_SCOPE,
    ): IVariableSymbol {
      return {
        ...TestSymbolUtils.base({
          kind: "variable",
          name,
          scopePath: scopeName,
          sourceFile: "sensor.cnx",
          sourceLine: line,
          isExported,
        }),
        type: TTypeUtils.createPrimitive("u8"),
        isArray: false,
        isConst: false,
        isAtomic: false,
        isVolatile: false,
        overflowBehavior: "clamp",
      };
    }

    it("reports the two members that share a truncated prefix", () => {
      const table = new SymbolTable();
      table.addTSymbol(scopeVariable("calibrationOffsetValue", 2));
      table.addTSymbol(scopeVariable("calibrationOffsetLimit", 3));

      const conflicts = table.detectMISRA51Conflicts(targetCaps);

      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].severity).toBe("error");
      expect(conflicts[0].definitions).toHaveLength(2);
      expect(conflicts[0].message).toContain("MISRA C:2012 Rule 5.1");
      // The code is a field on the conflict, not text inside the message: the
      // consumer renders `error[<code>]`. Asserting it in the message text is
      // what let #1339's producer and #1342's consumer each apply a code
      // independently.
      expect(conflicts[0].code).toBe("E0204");
      expect(conflicts[0].message).not.toContain("E0204");
      // Position comes from the conflict, not re-derived downstream.
      expect(conflicts[0].line).toBe(2);
      expect(conflicts[0].column).toBe(0);
    });

    it("names the C-Next names the author wrote, not the generated ones", () => {
      // #1292: `TemperatureSensorController__calibrationOffsetValue` appears in
      // no source file, so pointing at it does not help anyone rename anything.
      const table = new SymbolTable();
      table.addTSymbol(scopeVariable("calibrationOffsetValue", 2));
      table.addTSymbol(scopeVariable("calibrationOffsetLimit", 3));

      const message = table.detectMISRA51Conflicts(targetCaps)[0].message;

      expect(message).toContain(
        `${LONG_SCOPE}.calibrationOffsetValue (sensor.cnx:2)`,
      );
      expect(message).toContain(
        `${LONG_SCOPE}.calibrationOffsetLimit (sensor.cnx:3)`,
      );
      expect(message).not.toContain(`${LONG_SCOPE}__calibrationOffsetValue`);
    });

    it("groups three colliding members into one diagnostic", () => {
      const table = new SymbolTable();
      table.addTSymbol(scopeVariable("calibrationOffsetValue", 2));
      table.addTSymbol(scopeVariable("calibrationOffsetLimit", 3));
      table.addTSymbol(scopeVariable("calibrationOffsetScale", 4));

      const conflicts = table.detectMISRA51Conflicts(targetCaps);

      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].definitions).toHaveLength(3);
    });

    it("stays silent when the names diverge inside the limit", () => {
      const table = new SymbolTable();
      // "...__re" vs "...__ra" -- they differ at exactly the 31st character.
      table.addTSymbol(scopeVariable("readValue", 2));
      table.addTSymbol(scopeVariable("rawValue", 3));

      expect(table.detectMISRA51Conflicts(targetCaps)).toHaveLength(0);
    });

    it("stays silent for a declaration registered more than once", () => {
      // One file reached along two include paths is one identifier, not two.
      const table = new SymbolTable();
      table.addTSymbol(scopeVariable("calibrationOffsetValue", 2));
      table.addTSymbol(scopeVariable("calibrationOffsetValue", 2));

      expect(table.detectMISRA51Conflicts(targetCaps)).toHaveLength(0);
    });

    it("stays silent when the capability is not configured", () => {
      const table = new SymbolTable();
      table.addTSymbol(scopeVariable("calibrationOffsetValue", 2));
      table.addTSymbol(scopeVariable("calibrationOffsetLimit", 3));

      const withoutLimit = {
        wordSize: 32,
        hasLdrexStrex: false,
        hasBasepri: false,
      } as unknown as ITargetCapabilities;

      expect(table.detectMISRA51Conflicts(withoutLimit)).toHaveLength(0);
    });

    it.each([
      { limit: 63, expected: 0, why: "a wider budget separates them" },
      { limit: 31, expected: 1, why: "C99's guarantee does not" },
      { limit: 20, expected: 1, why: "a narrower budget does not either" },
    ])("honours the target's limit of $limit ($why)", ({ limit, expected }) => {
      const table = new SymbolTable();
      table.addTSymbol(scopeVariable("calibrationOffsetValue", 2));
      table.addTSymbol(scopeVariable("calibrationOffsetLimit", 3));

      const conflicts = table.detectMISRA51Conflicts({
        ...targetCaps,
        significantExternalIdentifierChars: limit,
      });

      expect(conflicts).toHaveLength(expected);
    });

    it("ignores private members, which are emitted static", () => {
      // ADR-016 emits `private` as `static`. Internal linkage gets 63
      // significant characters under a different rule, not 31 under 5.1.
      const table = new SymbolTable();
      table.addTSymbol(scopeVariable("shadowRegisterMirrorAlpha", 2, false));
      table.addTSymbol(scopeVariable("shadowRegisterMirrorOmega", 3, false));

      expect(table.detectMISRA51Conflicts(targetCaps)).toHaveLength(0);
    });

    it("ignores types, which name nothing the linker resolves", () => {
      const table = new SymbolTable();
      const scopePath = LONG_SCOPE;
      for (const [name, line] of [
        ["calibrationProfileAlpha", 2],
        ["calibrationProfileOmega", 3],
      ] as Array<[string, number]>) {
        table.addTSymbol({
          ...TestSymbolUtils.base({
            kind: "enum",
            name,
            scopePath,
            sourceFile: "sensor.cnx",
            sourceLine: line,
          }),
          members: [],
        } as unknown as IEnumSymbol);
      }

      expect(table.detectMISRA51Conflicts(targetCaps)).toHaveLength(0);
    });

    it("ignores C and C++ header symbols", () => {
      // A header's identifiers are not this transpiler's to rename, and C++
      // names are mangled rather than truncated.
      const table = new SymbolTable();
      const colliding = [
        "TemperatureSensorController__calibrationValue",
        "TemperatureSensorController__calibrationLimit",
      ];

      table.addCSymbol({
        kind: "function",
        name: colliding[0],
        sourceFile: "sensor.h",
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.C,
        isExported: true,
        type: "void",
        parameters: [],
      } as TCSymbol);
      table.addCppSymbol({
        kind: "function",
        name: colliding[1],
        sourceFile: "sensor.hpp",
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.Cpp,
        isExported: true,
        returnType: "void",
        parameters: [],
      } as unknown as TCppSymbol);

      expect(table.detectMISRA51Conflicts(targetCaps)).toHaveLength(0);
    });

    it("reports a global colliding with a scope member", () => {
      const table = new SymbolTable();
      table.addTSymbol(scopeVariable("calibrationOffsetValue", 2));
      table.addTSymbol({
        ...TestSymbolUtils.base({
          kind: "variable",
          name: "TemperatureSensorController__calibrationOffsetLimit",
          sourceFile: "sensor.cnx",
          sourceLine: 9,
        }),
        type: TTypeUtils.createPrimitive("u8"),
        isArray: false,
        isConst: false,
        isAtomic: false,
        isVolatile: false,
        overflowBehavior: "clamp",
      } as IVariableSymbol);

      expect(table.detectMISRA51Conflicts(targetCaps)).toHaveLength(1);
    });
  });
});
