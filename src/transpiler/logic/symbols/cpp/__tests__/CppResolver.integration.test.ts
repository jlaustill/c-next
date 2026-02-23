/**
 * Integration tests for CppResolver.
 * Verifies that the resolver correctly extracts symbols from C++ parse trees.
 */

import { describe, it, expect, beforeEach } from "vitest";
import CppResolver from "../index";
import SymbolTable from "../../SymbolTable";
import TestHelpers from "./testHelpers";

describe("CppResolver", () => {
  let symbolTable: SymbolTable;

  beforeEach(() => {
    symbolTable = new SymbolTable();
  });

  describe("namespace collection", () => {
    it("collects a simple namespace", () => {
      const source = `namespace MyNamespace { }`;
      const tree = TestHelpers.parseCpp(source);
      expect(tree).not.toBeNull();
      const result = CppResolver.resolve(tree!, "test.hpp", symbolTable);

      expect(result.symbols).toHaveLength(1);
      expect(result.symbols[0]).toMatchObject({
        kind: "namespace",
        name: "MyNamespace",
        sourceFile: "test.hpp",
      });
    });

    it("collects nested namespaces", () => {
      const source = `namespace Outer { namespace Inner { } }`;
      const tree = TestHelpers.parseCpp(source);
      expect(tree).not.toBeNull();
      const result = CppResolver.resolve(tree!, "test.hpp", symbolTable);

      expect(result.symbols).toHaveLength(2);
      expect(result.symbols[0].name).toBe("Outer");
      expect(result.symbols[1].name).toBe("Outer::Inner");
    });
  });

  describe("class collection", () => {
    it("collects a simple class", () => {
      const source = `class MyClass { };`;
      const tree = TestHelpers.parseCpp(source);
      expect(tree).not.toBeNull();
      const result = CppResolver.resolve(tree!, "test.hpp", symbolTable);

      expect(result.symbols).toHaveLength(1);
      expect(result.symbols[0]).toMatchObject({
        kind: "class",
        name: "MyClass",
        sourceFile: "test.hpp",
      });
    });

    it("collects a class with fields", () => {
      const source = `class Point { int x; int y; };`;
      const tree = TestHelpers.parseCpp(source);
      expect(tree).not.toBeNull();
      const result = CppResolver.resolve(tree!, "test.hpp", symbolTable);

      expect(result.symbols).toHaveLength(1);
      const classSymbol = result.symbols[0];
      expect(classSymbol.kind).toBe("class");

      // Verify fields are stored in symbol table
      const xType = symbolTable.getStructFieldType("Point", "x");
      expect(xType).toBe("int");

      const yType = symbolTable.getStructFieldType("Point", "y");
      expect(yType).toBe("int");
    });

    it("collects class in namespace", () => {
      const source = `namespace NS { class MyClass { }; }`;
      const tree = TestHelpers.parseCpp(source);
      expect(tree).not.toBeNull();
      const result = CppResolver.resolve(tree!, "test.hpp", symbolTable);

      const classSymbol = result.symbols.find((s) => s.kind === "class");
      expect(classSymbol).toBeDefined();
      expect(classSymbol!.name).toBe("NS::MyClass");
      expect(classSymbol!.parent).toBe("NS");
    });

    it("collects member functions", () => {
      const source = `class MyClass { void doSomething(); int getValue(); };`;
      const tree = TestHelpers.parseCpp(source);
      expect(tree).not.toBeNull();
      const result = CppResolver.resolve(tree!, "test.hpp", symbolTable);

      const funcSymbols = result.symbols.filter((s) => s.kind === "function");
      expect(funcSymbols).toHaveLength(2);
      expect(funcSymbols[0].name).toBe("MyClass::doSomething");
      expect(funcSymbols[1].name).toBe("MyClass::getValue");
    });

    it("collects inline member function definitions", () => {
      const source = `class MyClass { void inline_func() { } };`;
      const tree = TestHelpers.parseCpp(source);
      expect(tree).not.toBeNull();
      const result = CppResolver.resolve(tree!, "test.hpp", symbolTable);

      const funcSymbol = result.symbols.find((s) => s.kind === "function");
      expect(funcSymbol).toBeDefined();
      expect(funcSymbol!.name).toBe("MyClass::inline_func");
    });
  });

  describe("enum collection", () => {
    it("collects a simple enum", () => {
      const source = `enum Color { RED, GREEN, BLUE };`;
      const tree = TestHelpers.parseCpp(source);
      expect(tree).not.toBeNull();
      const result = CppResolver.resolve(tree!, "test.hpp", symbolTable);

      expect(result.symbols).toHaveLength(1);
      expect(result.symbols[0]).toMatchObject({
        kind: "enum",
        name: "Color",
        sourceFile: "test.hpp",
      });
    });

    it("collects typed enum with bit width", () => {
      const source = `enum class EPressureType : uint8_t { PSIA, PSIG };`;
      const tree = TestHelpers.parseCpp(source);
      expect(tree).not.toBeNull();
      const result = CppResolver.resolve(tree!, "test.hpp", symbolTable);

      const enumSymbol = result.symbols.find((s) => s.kind === "enum");
      expect(enumSymbol).toBeDefined();
      expect(enumSymbol!.name).toBe("EPressureType");

      // Check that bit width was stored in symbol table
      const bitWidth = symbolTable.getEnumBitWidth("EPressureType");
      expect(bitWidth).toBe(8);
    });
  });

  describe("function collection", () => {
    it("collects a free function definition", () => {
      const source = `void myFunction() { }`;
      const tree = TestHelpers.parseCpp(source);
      expect(tree).not.toBeNull();
      const result = CppResolver.resolve(tree!, "test.hpp", symbolTable);

      expect(result.symbols).toHaveLength(1);
      expect(result.symbols[0]).toMatchObject({
        kind: "function",
        name: "myFunction",
        type: "void",
      });
    });

    it("collects function with parameters", () => {
      const source = `int add(int a, int b) { return a + b; }`;
      const tree = TestHelpers.parseCpp(source);
      expect(tree).not.toBeNull();
      const result = CppResolver.resolve(tree!, "test.hpp", symbolTable);

      const funcSymbol = result.symbols[0];
      expect(funcSymbol.kind).toBe("function");
      if (funcSymbol.kind === "function") {
        expect(funcSymbol.parameters).toHaveLength(2);
        expect(funcSymbol.parameters![0].name).toBe("a");
        expect(funcSymbol.parameters![0].type).toBe("int");
      }
    });

    it("collects function declaration (prototype)", () => {
      const source = `int myFunc(int x);`;
      const tree = TestHelpers.parseCpp(source);
      expect(tree).not.toBeNull();
      const result = CppResolver.resolve(tree!, "test.hpp", symbolTable);

      const funcSymbol = result.symbols[0];
      expect(funcSymbol.kind).toBe("function");
      if (funcSymbol.kind === "function") {
        expect(funcSymbol.isDeclaration).toBe(true);
      }
    });

    it("collects function in namespace", () => {
      const source = `namespace NS { void foo() { } }`;
      const tree = TestHelpers.parseCpp(source);
      expect(tree).not.toBeNull();
      const result = CppResolver.resolve(tree!, "test.hpp", symbolTable);

      const funcSymbol = result.symbols.find((s) => s.kind === "function");
      expect(funcSymbol).toBeDefined();
      expect(funcSymbol!.name).toBe("NS::foo");
    });
  });

  describe("variable collection", () => {
    it("collects a global variable", () => {
      const source = `int globalVar;`;
      const tree = TestHelpers.parseCpp(source);
      expect(tree).not.toBeNull();
      const result = CppResolver.resolve(tree!, "test.hpp", symbolTable);

      expect(result.symbols).toHaveLength(1);
      expect(result.symbols[0]).toMatchObject({
        kind: "variable",
        name: "globalVar",
        type: "int",
      });
    });

    it("collects array variable", () => {
      const source = `int buffer[32];`;
      const tree = TestHelpers.parseCpp(source);
      expect(tree).not.toBeNull();
      const result = CppResolver.resolve(tree!, "test.hpp", symbolTable);

      const varSymbol = result.symbols[0];
      expect(varSymbol.kind).toBe("variable");
      if (varSymbol.kind === "variable") {
        expect(varSymbol.isArray).toBe(true);
        expect(varSymbol.arrayDimensions).toEqual([32]);
      }
    });
  });

  describe("type alias collection", () => {
    it("collects a using alias", () => {
      const source = `using MyInt = int;`;
      const tree = TestHelpers.parseCpp(source);
      expect(tree).not.toBeNull();
      const result = CppResolver.resolve(tree!, "test.hpp", symbolTable);

      expect(result.symbols).toHaveLength(1);
      expect(result.symbols[0]).toMatchObject({
        kind: "type",
        name: "MyInt",
      });
    });
  });

  describe("anonymous struct typedef", () => {
    it("collects anonymous struct with typedef name", () => {
      const source = `struct { int x; int y; } Point;`;
      const tree = TestHelpers.parseCpp(source);
      expect(tree).not.toBeNull();
      const result = CppResolver.resolve(tree!, "test.hpp", symbolTable);

      const classSymbol = result.symbols.find((s) => s.kind === "class");
      expect(classSymbol).toBeDefined();
      expect(classSymbol!.name).toBe("Point");
    });
  });

  // ADR-058: "length" is no longer reserved since .length was deprecated
  describe("warnings", () => {
    it("does not warn about 'length' field names after ADR-058", () => {
      const source = `class MyStruct { int length; };`;
      const tree = TestHelpers.parseCpp(source);
      expect(tree).not.toBeNull();
      const result = CppResolver.resolve(tree!, "test.hpp", symbolTable);

      // No warnings since "length" is no longer reserved
      expect(result.warnings).toHaveLength(0);
    });
  });
});
