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
import TestScopeUtils from "../cnext/__tests__/testUtils";
import TTypeUtils from "../../../../utils/TTypeUtils";
import TCSymbol from "../../../types/symbols/c/TCSymbol";
import TCppSymbol from "../../../types/symbols/cpp/TCppSymbol";
import TestSymbolUtils from "../cnext/__tests__/testSymbolUtils";
import ScopeUtils from "../../../../utils/ScopeUtils";
import IScopeSymbol from "../../../types/symbols/IScopeSymbol";

describe("SymbolTable", () => {
  let symbolTable: SymbolTable;

  beforeEach(() => {
    symbolTable = new SymbolTable();
  });

  // ========================================================================
  // resolveDeclaration (ADR-057 scope-chain resolution, #1285)
  // ========================================================================

  describe("resolveDeclaration", () => {
    const globalScope = ScopeUtils.createGlobalScope();
    const outer = ScopeUtils.createScope("Outer", globalScope);
    const inner = ScopeUtils.createScope("Inner", outer);

    const variableIn = (
      name: string,
      scope: IScopeSymbol,
    ): IVariableSymbol => ({
      ...TestSymbolUtils.base({ kind: "variable", name, scope }),
      type: TTypeUtils.createPrimitive("u32"),
      isArray: false,
      isConst: false,
      isAtomic: false,
      isVolatile: false,
    });

    it("resolves a name declared in the asking scope", () => {
      symbolTable.addTSymbol(variableIn("tick", outer));

      const found = symbolTable.resolveDeclaration("tick", outer);

      expect(found).toHaveLength(1);
      expect(found[0].fullyQualifiedCName).toBe("Outer__tick");
    });

    it("falls through to the global scope when the scope does not declare it", () => {
      symbolTable.addTSymbol(variableIn("tick", globalScope));

      const found = symbolTable.resolveDeclaration("tick", outer);

      expect(found).toHaveLength(1);
      expect(found[0].fullyQualifiedCName).toBe("tick");
    });

    it("returns nothing when no scope on the chain declares the name", () => {
      expect(symbolTable.resolveDeclaration("missing", inner)).toEqual([]);
    });

    // The property #1285 exists for. Nested scopes are unreachable from .cnx
    // (grammar/CNext.g4:81-89 -- scopeMember has no scopeDeclaration branch),
    // so a unit test built through ScopeUtils.createScope is the ONLY way to
    // cover it. Do not delete these as "testing an impossible case": a
    // leaf-only walk is accidentally correct at depth one and wrong here.
    it("walks past an intermediate scope to a grandparent declaration", () => {
      symbolTable.addTSymbol(variableIn("tick", outer));

      const found = symbolTable.resolveDeclaration("tick", inner);

      expect(found).toHaveLength(1);
      // Outer__tick, NOT Inner__tick and NOT Outer__Inner__tick -- the C name
      // comes from where the symbol was DECLARED, not from where it was asked.
      expect(found[0].fullyQualifiedCName).toBe("Outer__tick");
    });

    it("prefers the nearest declaration when an inner scope shadows an outer one", () => {
      symbolTable.addTSymbol(variableIn("tick", outer));
      symbolTable.addTSymbol(variableIn("tick", inner));

      const found = symbolTable.resolveDeclaration("tick", inner);

      expect(found).toHaveLength(1);
      expect(found[0].fullyQualifiedCName).toBe("Outer__Inner__tick");
    });

    it("returns every overload declared at the resolving level", () => {
      symbolTable.addTSymbol(variableIn("tick", outer));
      symbolTable.addTSymbol(variableIn("tick", outer));

      expect(symbolTable.resolveDeclaration("tick", inner)).toHaveLength(2);
    });

    it("treats a null scope as the global scope", () => {
      symbolTable.addTSymbol(variableIn("tick", globalScope));

      expect(symbolTable.resolveDeclaration("tick", null)).toEqual([]);
    });
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
          scope: TestScopeUtils.createMockGlobalScope(),
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
          scope: TestScopeUtils.createMockGlobalScope(),
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
      });

      symbolTable.addTSymbol({
        ...TestSymbolUtils.base({
          kind: "variable",
          name: "duplicate",
          scope: TestScopeUtils.createMockGlobalScope(),
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
            scope: TestScopeUtils.createMockGlobalScope(),
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
        },
        {
          ...TestSymbolUtils.base({
            kind: "variable",
            name: "var2",
            scope: TestScopeUtils.createMockGlobalScope(),
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
          scope: TestScopeUtils.createMockGlobalScope(),
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
          scope: TestScopeUtils.createMockGlobalScope(),
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
          scope: TestScopeUtils.createMockGlobalScope(),
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

    // Issue #817: Scope-private members should NOT conflict across scopes
    it("should NOT detect conflict for same-named members in different scopes", () => {
      // Create two different named scopes
      const globalScope = TestScopeUtils.createMockGlobalScope();
      const fooScope = TestScopeUtils.createMockScope("Foo", globalScope);
      const barScope = TestScopeUtils.createMockScope("Bar", globalScope);

      // Add 'enabled' variable in scope Foo
      symbolTable.addTSymbol({
        ...TestSymbolUtils.base({
          kind: "variable",
          name: "enabled",
          scope: fooScope,
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
      });

      // Add 'enabled' variable in scope Bar
      symbolTable.addTSymbol({
        ...TestSymbolUtils.base({
          kind: "variable",
          name: "enabled",
          scope: barScope,
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
      });

      // These are NOT conflicts - they generate Foo_enabled and Bar_enabled
      expect(symbolTable.hasConflict("enabled")).toBe(false);
    });

    // Issue #817: Same-named functions in different scopes are not conflicts
    it("should NOT detect conflict for same-named functions in different scopes", () => {
      const globalScope = TestScopeUtils.createMockGlobalScope();
      const fooScope = TestScopeUtils.createMockScope("Foo", globalScope);
      const barScope = TestScopeUtils.createMockScope("Bar", globalScope);

      // Add 'initialize' function in scope Foo
      symbolTable.addTSymbol({
        ...TestSymbolUtils.base({
          kind: "function",
          name: "initialize",
          scope: fooScope,
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
          scope: barScope,
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
      const globalScope = TestScopeUtils.createMockGlobalScope();
      const fooScope = TestScopeUtils.createMockScope("Foo", globalScope);

      // Add 'duplicate' variable in scope Foo twice
      symbolTable.addTSymbol({
        ...TestSymbolUtils.base({
          kind: "variable",
          name: "duplicate",
          scope: fooScope,
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
      });

      symbolTable.addTSymbol({
        ...TestSymbolUtils.base({
          kind: "variable",
          name: "duplicate",
          scope: fooScope,
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
      const globalScope = TestScopeUtils.createMockGlobalScope();
      const outer = TestScopeUtils.createMockScope("Outer", globalScope);
      const other = TestScopeUtils.createMockScope("Other", globalScope);
      const outerInner = TestScopeUtils.createMockScope("Inner", outer);
      const otherInner = TestScopeUtils.createMockScope("Inner", other);

      // Outer.Inner.tick and Other.Inner.tick -- different symbols, and they
      // generate different C names, so they do not compete.
      for (const [scope, line] of [
        [outerInner, 2],
        [otherInner, 20],
      ] as const) {
        symbolTable.addTSymbol({
          ...TestSymbolUtils.base({
            kind: "variable",
            name: "tick",
            scope,
            sourceFile: "test.cnx",
            sourceLine: line,
            isExported: false,
          }),
          type: TTypeUtils.createPrimitive("u32"),
          isArray: false,
          isConst: false,
          isAtomic: false,
          isVolatile: false,
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
      const globalScope = TestScopeUtils.createMockGlobalScope();
      const outer = TestScopeUtils.createMockScope("Outer", globalScope);
      const inner = TestScopeUtils.createMockScope("Inner", outer);

      for (const line of [2, 5]) {
        symbolTable.addTSymbol({
          ...TestSymbolUtils.base({
            kind: "variable",
            name: "tick",
            scope: inner,
            sourceFile: "test.cnx",
            sourceLine: line,
            isExported: false,
          }),
          type: TTypeUtils.createPrimitive("u32"),
          isArray: false,
          isConst: false,
          isAtomic: false,
          isVolatile: false,
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
      const globalScope = TestScopeUtils.createMockGlobalScope();

      // Add two global variables with same name
      symbolTable.addTSymbol({
        ...TestSymbolUtils.base({
          kind: "variable",
          name: "globalVar",
          scope: globalScope,
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
      });

      symbolTable.addTSymbol({
        ...TestSymbolUtils.base({
          kind: "variable",
          name: "globalVar",
          scope: globalScope,
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
      });

      // Two globals with same name IS a conflict
      expect(symbolTable.hasConflict("globalVar")).toBe(true);
    });

    // Issue #967: Scoped C-Next symbols live in a namespace and don't conflict
    // with C's global symbols. Only global-scope C-Next symbols can conflict.
    it("should NOT detect conflict for scoped C-Next method vs C function with same bare name", () => {
      const globalScope = TestScopeUtils.createMockGlobalScope();
      const touchScope = TestScopeUtils.createMockScope("Touch", globalScope);

      // Add C-Next scoped function 'read' in scope 'Touch'
      // This transpiles to Touch_read()
      symbolTable.addTSymbol({
        ...TestSymbolUtils.base({
          kind: "function",
          name: "read",
          scope: touchScope,
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
      const globalScope = TestScopeUtils.createMockGlobalScope();

      // Add global C-Next function 'read'
      symbolTable.addTSymbol({
        ...TestSymbolUtils.base({
          kind: "function",
          name: "read",
          scope: globalScope,
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
          scope: TestScopeUtils.createMockGlobalScope(),
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
          scope: TestScopeUtils.createMockGlobalScope(),
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
          scope: TestScopeUtils.createMockGlobalScope(),
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
          scope: TestScopeUtils.createMockGlobalScope(),
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
          scope: TestScopeUtils.createMockGlobalScope(),
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
});
