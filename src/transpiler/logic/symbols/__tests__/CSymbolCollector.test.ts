import { describe, expect, it } from "vitest";
import parseC from "./cTestHelpers";
import CSymbolCollector from "../CSymbolCollector";
import SymbolTable from "../SymbolTable";
import ESymbolKind from "../../../../utils/types/ESymbolKind";
import ESourceLanguage from "../../../../utils/types/ESourceLanguage";

describe("CSymbolCollector - Basic Functionality", () => {
  it("creates collector with source file", () => {
    const collector = new CSymbolCollector("test.h");
    expect(collector).toBeDefined();
  });

  it("returns empty array for empty translation unit", () => {
    const code = "";
    const tree = parseC(code);
    const collector = new CSymbolCollector("test.h");
    const symbols = collector.collect(tree);
    expect(symbols).toEqual([]);
  });

  it("tracks source file correctly", () => {
    const code = `void foo();`;
    const tree = parseC(code);
    const collector = new CSymbolCollector("myfile.h");
    const symbols = collector.collect(tree);
    expect(symbols[0].sourceFile).toBe("myfile.h");
  });

  it("tracks source line numbers", () => {
    const code = `

void foo();`;
    const tree = parseC(code);
    const collector = new CSymbolCollector("test.h");
    const symbols = collector.collect(tree);
    expect(symbols[0].sourceLine).toBe(3);
  });

  it("sets source language to C", () => {
    const code = `void foo();`;
    const tree = parseC(code);
    const collector = new CSymbolCollector("test.h");
    const symbols = collector.collect(tree);
    expect(symbols[0].sourceLanguage).toBe(ESourceLanguage.C);
  });

  it("returns empty warnings initially", () => {
    const collector = new CSymbolCollector("test.h");
    expect(collector.getWarnings()).toEqual([]);
  });
});

describe("CSymbolCollector - Function Definitions", () => {
  it("collects function definition", () => {
    const code = `void foo() { }`;
    const tree = parseC(code);
    const collector = new CSymbolCollector("test.h");
    const symbols = collector.collect(tree);

    expect(symbols).toHaveLength(1);
    expect(symbols[0].name).toBe("foo");
    expect(symbols[0].kind).toBe(ESymbolKind.Function);
    expect(symbols[0].type).toBe("void");
    expect(symbols[0].isExported).toBe(true);
    expect(symbols[0].isDeclaration).toBe(false);
  });

  it("collects function with return type", () => {
    const code = `int getCount() { return 0; }`;
    const tree = parseC(code);
    const collector = new CSymbolCollector("test.h");
    const symbols = collector.collect(tree);

    expect(symbols[0].type).toBe("int");
  });

  it("collects function with complex return type", () => {
    const code = `unsigned long getValue() { return 0; }`;
    const tree = parseC(code);
    const collector = new CSymbolCollector("test.h");
    const symbols = collector.collect(tree);

    // Type parts are space-separated
    expect(symbols[0].type).toBe("unsigned long");
  });

  it("defaults to int when no return type specified", () => {
    // Old C style - no return type means int
    const code = `foo() { }`;
    const tree = parseC(code);
    const collector = new CSymbolCollector("test.h");
    const symbols = collector.collect(tree);

    expect(symbols[0].type).toBe("int");
  });

  it("collects multiple function definitions", () => {
    const code = `
      void init() { }
      int process() { return 0; }
      void cleanup() { }
    `;
    const tree = parseC(code);
    const collector = new CSymbolCollector("test.h");
    const symbols = collector.collect(tree);

    expect(symbols).toHaveLength(3);
    expect(symbols.map((s) => s.name)).toEqual(["init", "process", "cleanup"]);
  });
});

describe("CSymbolCollector - Function Prototypes", () => {
  it("collects function prototype", () => {
    const code = `void bar();`;
    const tree = parseC(code);
    const collector = new CSymbolCollector("test.h");
    const symbols = collector.collect(tree);

    expect(symbols).toHaveLength(1);
    expect(symbols[0].name).toBe("bar");
    expect(symbols[0].kind).toBe(ESymbolKind.Function);
    expect(symbols[0].isDeclaration).toBe(true);
    expect(symbols[0].isExported).toBe(true);
  });

  it("collects extern function prototype", () => {
    const code = `extern void externalFunc();`;
    const tree = parseC(code);
    const collector = new CSymbolCollector("test.h");
    const symbols = collector.collect(tree);

    expect(symbols[0].name).toBe("externalFunc");
    expect(symbols[0].isExported).toBe(false);
    expect(symbols[0].isDeclaration).toBe(true);
  });

  it("collects function prototype with parameters", () => {
    const code = `int add(int a, int b);`;
    const tree = parseC(code);
    const collector = new CSymbolCollector("test.h");
    const symbols = collector.collect(tree);

    expect(symbols[0].name).toBe("add");
    expect(symbols[0].type).toBe("int");
  });
});

describe("CSymbolCollector - Variable Declarations", () => {
  it("collects global variable", () => {
    const code = `int counter;`;
    const tree = parseC(code);
    const collector = new CSymbolCollector("test.h");
    const symbols = collector.collect(tree);

    expect(symbols).toHaveLength(1);
    expect(symbols[0].name).toBe("counter");
    expect(symbols[0].kind).toBe(ESymbolKind.Variable);
    expect(symbols[0].type).toBe("int");
    expect(symbols[0].isExported).toBe(true);
  });

  it("collects extern variable", () => {
    const code = `extern int globalValue;`;
    const tree = parseC(code);
    const collector = new CSymbolCollector("test.h");
    const symbols = collector.collect(tree);

    expect(symbols[0].name).toBe("globalValue");
    expect(symbols[0].kind).toBe(ESymbolKind.Variable);
    expect(symbols[0].isExported).toBe(false);
    expect(symbols[0].isDeclaration).toBe(true);
  });

  it("collects multiple variables in one declaration", () => {
    const code = `int x, y, z;`;
    const tree = parseC(code);
    const collector = new CSymbolCollector("test.h");
    const symbols = collector.collect(tree);

    expect(symbols).toHaveLength(3);
    expect(symbols.map((s) => s.name)).toEqual(["x", "y", "z"]);
    symbols.forEach((s) => {
      expect(s.kind).toBe(ESymbolKind.Variable);
      expect(s.type).toBe("int");
    });
  });
});

describe("CSymbolCollector - Typedefs", () => {
  it("collects simple typedef", () => {
    const code = `typedef int MyInt;`;
    const tree = parseC(code);
    const collector = new CSymbolCollector("test.h");
    const symbols = collector.collect(tree);

    expect(symbols).toHaveLength(1);
    expect(symbols[0].name).toBe("MyInt");
    expect(symbols[0].kind).toBe(ESymbolKind.Type);
    expect(symbols[0].type).toBe("int");
    expect(symbols[0].isExported).toBe(true);
  });

  it("collects typedef with unsigned type", () => {
    const code = `typedef unsigned char uint8_t;`;
    const tree = parseC(code);
    const collector = new CSymbolCollector("test.h");
    const symbols = collector.collect(tree);

    expect(symbols[0].name).toBe("uint8_t");
    expect(symbols[0].kind).toBe(ESymbolKind.Type);
  });

  it("collects multiple typedefs", () => {
    const code = `
      typedef int Int32;
      typedef unsigned int UInt32;
    `;
    const tree = parseC(code);
    const collector = new CSymbolCollector("test.h");
    const symbols = collector.collect(tree);

    expect(symbols).toHaveLength(2);
    expect(symbols[0].name).toBe("Int32");
    expect(symbols[1].name).toBe("UInt32");
  });
});

describe("CSymbolCollector - Structs", () => {
  it("collects named struct", () => {
    const code = `struct Point { int x; int y; };`;
    const tree = parseC(code);
    const collector = new CSymbolCollector("test.h");
    const symbols = collector.collect(tree);

    const structSym = symbols.find((s) => s.name === "Point");
    expect(structSym).toBeDefined();
    expect(structSym?.kind).toBe(ESymbolKind.Struct);
    expect(structSym?.type).toBe("struct");
    expect(structSym?.isExported).toBe(true);
  });

  it("marks named struct as needing struct keyword", () => {
    const code = `struct Point { int x; int y; };`;
    const tree = parseC(code);
    const symbolTable = new SymbolTable();
    const collector = new CSymbolCollector("test.h", symbolTable);
    collector.collect(tree);

    expect(symbolTable.checkNeedsStructKeyword("Point")).toBe(true);
  });

  it("collects typedef struct (anonymous)", () => {
    const code = `typedef struct { int x; int y; } Point;`;
    const tree = parseC(code);
    const collector = new CSymbolCollector("test.h");
    const symbols = collector.collect(tree);

    // Anonymous typedef struct creates a struct symbol with the typedef name
    const structSym = symbols.find(
      (s) => s.name === "Point" && s.kind === ESymbolKind.Struct,
    );
    expect(structSym).toBeDefined();
  });

  it("does not mark typedef struct as needing struct keyword", () => {
    const code = `typedef struct { int x; int y; } Point;`;
    const tree = parseC(code);
    const symbolTable = new SymbolTable();
    const collector = new CSymbolCollector("test.h", symbolTable);
    collector.collect(tree);

    expect(symbolTable.checkNeedsStructKeyword("Point")).toBe(false);
  });

  it("collects typedef struct with tag name", () => {
    const code = `typedef struct _Point { int x; int y; } Point;`;
    const tree = parseC(code);
    const collector = new CSymbolCollector("test.h");
    const symbols = collector.collect(tree);

    // Should have struct with tag name
    const structSym = symbols.find(
      (s) => s.name === "_Point" && s.kind === ESymbolKind.Struct,
    );
    expect(structSym).toBeDefined();
  });

  it("collects union", () => {
    const code = `union Data { int i; float f; };`;
    const tree = parseC(code);
    const collector = new CSymbolCollector("test.h");
    const symbols = collector.collect(tree);

    const unionSym = symbols.find((s) => s.name === "Data");
    expect(unionSym).toBeDefined();
    expect(unionSym?.kind).toBe(ESymbolKind.Struct);
    expect(unionSym?.type).toBe("union");
  });

  it("skips anonymous struct without typedef", () => {
    const code = `struct { int x; } point;`;
    const tree = parseC(code);
    const collector = new CSymbolCollector("test.h");
    const symbols = collector.collect(tree);

    // Should only have the variable, no struct symbol
    expect(symbols).toHaveLength(1);
    expect(symbols[0].name).toBe("point");
    expect(symbols[0].kind).toBe(ESymbolKind.Variable);
  });
});

describe("CSymbolCollector - Struct Fields", () => {
  it("collects struct fields into symbol table", () => {
    const code = `struct Point { int x; int y; };`;
    const tree = parseC(code);
    const symbolTable = new SymbolTable();
    const collector = new CSymbolCollector("test.h", symbolTable);
    collector.collect(tree);

    const fieldsMap = symbolTable.getStructFields("Point");
    expect(fieldsMap).toBeDefined();
    expect(fieldsMap?.size).toBe(2);
    expect(fieldsMap?.get("x")?.type).toBe("int");
    expect(fieldsMap?.get("y")?.type).toBe("int");
  });

  it("collects struct fields with different types", () => {
    const code = `struct Person { char name[32]; int age; float height; };`;
    const tree = parseC(code);
    const symbolTable = new SymbolTable();
    const collector = new CSymbolCollector("test.h", symbolTable);
    collector.collect(tree);

    const fieldsMap = symbolTable.getStructFields("Person");
    expect(fieldsMap).toBeDefined();
    expect(fieldsMap?.size).toBe(3);
    expect(fieldsMap?.get("name")?.type).toBe("char");
    expect(fieldsMap?.get("age")?.type).toBe("int");
    expect(fieldsMap?.get("height")?.type).toBe("float");
  });

  it("collects array field dimensions", () => {
    const code = `struct Buffer { char data[256]; };`;
    const tree = parseC(code);
    const symbolTable = new SymbolTable();
    const collector = new CSymbolCollector("test.h", symbolTable);
    collector.collect(tree);

    const fieldsMap = symbolTable.getStructFields("Buffer");
    expect(fieldsMap?.get("data")?.arrayDimensions).toEqual([256]);
  });

  it("collects multi-dimensional array fields", () => {
    const code = `struct Matrix { int data[3][3]; };`;
    const tree = parseC(code);
    const symbolTable = new SymbolTable();
    const collector = new CSymbolCollector("test.h", symbolTable);
    collector.collect(tree);

    const fieldsMap = symbolTable.getStructFields("Matrix");
    expect(fieldsMap?.get("data")?.arrayDimensions).toEqual([3, 3]);
  });

  it("collects nested struct field type correctly", () => {
    const code = `
      struct Inner { int value; };
      struct Outer { struct Inner inner; };
    `;
    const tree = parseC(code);
    const symbolTable = new SymbolTable();
    const collector = new CSymbolCollector("test.h", symbolTable);
    collector.collect(tree);

    const fieldsMap = symbolTable.getStructFields("Outer");
    expect(fieldsMap?.get("inner")?.type).toBe("Inner");
  });

  it("warns about reserved field names", () => {
    const code = `struct Test { int length; };`;
    const tree = parseC(code);
    const symbolTable = new SymbolTable();
    const collector = new CSymbolCollector("test.h", symbolTable);
    collector.collect(tree);

    const warnings = collector.getWarnings();
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0]).toContain("length");
    expect(warnings[0]).toContain("conflicts with C-Next");
  });
});

describe("CSymbolCollector - Enums", () => {
  it("collects named enum", () => {
    const code = `enum Color { RED, GREEN, BLUE };`;
    const tree = parseC(code);
    const collector = new CSymbolCollector("test.h");
    const symbols = collector.collect(tree);

    const enumSym = symbols.find(
      (s) => s.name === "Color" && s.kind === ESymbolKind.Enum,
    );
    expect(enumSym).toBeDefined();
    expect(enumSym?.isExported).toBe(true);
  });

  it("collects enum members", () => {
    const code = `enum Color { RED, GREEN, BLUE };`;
    const tree = parseC(code);
    const collector = new CSymbolCollector("test.h");
    const symbols = collector.collect(tree);

    const members = symbols.filter((s) => s.kind === ESymbolKind.EnumMember);
    expect(members).toHaveLength(3);
    expect(members.map((m) => m.name)).toEqual(["RED", "GREEN", "BLUE"]);
    members.forEach((m) => {
      expect(m.parent).toBe("Color");
      expect(m.isExported).toBe(true);
    });
  });

  it("collects enum member line numbers", () => {
    const code = `enum Status {
      OK,
      ERROR,
      PENDING
    };`;
    const tree = parseC(code);
    const collector = new CSymbolCollector("test.h");
    const symbols = collector.collect(tree);

    const members = symbols.filter((s) => s.kind === ESymbolKind.EnumMember);
    expect(members[0].sourceLine).toBe(2);
    expect(members[1].sourceLine).toBe(3);
    expect(members[2].sourceLine).toBe(4);
  });

  it("skips anonymous enum", () => {
    const code = `enum { OPTION_A, OPTION_B };`;
    const tree = parseC(code);
    const collector = new CSymbolCollector("test.h");
    const symbols = collector.collect(tree);

    // Anonymous enums don't create an Enum symbol
    const enumSym = symbols.find((s) => s.kind === ESymbolKind.Enum);
    expect(enumSym).toBeUndefined();
  });
});

describe("CSymbolCollector - Complex Declarators", () => {
  it("handles array variable declaration", () => {
    const code = `int values[10];`;
    const tree = parseC(code);
    const collector = new CSymbolCollector("test.h");
    const symbols = collector.collect(tree);

    expect(symbols[0].name).toBe("values");
    expect(symbols[0].kind).toBe(ESymbolKind.Variable);
  });

  it("handles function pointer typedef", () => {
    const code = `typedef void (*Callback)(int);`;
    const tree = parseC(code);
    const collector = new CSymbolCollector("test.h");
    const symbols = collector.collect(tree);

    expect(symbols[0].name).toBe("Callback");
    expect(symbols[0].kind).toBe(ESymbolKind.Type);
  });

  it("handles pointer variable", () => {
    const code = `int *ptr;`;
    const tree = parseC(code);
    const collector = new CSymbolCollector("test.h");
    const symbols = collector.collect(tree);

    expect(symbols[0].name).toBe("ptr");
    expect(symbols[0].kind).toBe(ESymbolKind.Variable);
  });

  it("handles array field declarator (Issue #355)", () => {
    // Issue #355: extractDirectDeclaratorName must handle recursive directDeclarator for arrays
    const code = `struct Test { char buf[8]; };`;
    const tree = parseC(code);
    const symbolTable = new SymbolTable();
    const collector = new CSymbolCollector("test.h", symbolTable);
    collector.collect(tree);

    const fieldsMap = symbolTable.getStructFields("Test");
    expect(fieldsMap?.get("buf")).toBeDefined();
    expect(fieldsMap?.get("buf")?.arrayDimensions).toEqual([8]);
  });

  it("handles multi-dimensional array field declarator", () => {
    const code = `struct Matrix { int data[4][4]; };`;
    const tree = parseC(code);
    const symbolTable = new SymbolTable();
    const collector = new CSymbolCollector("test.h", symbolTable);
    collector.collect(tree);

    const fieldsMap = symbolTable.getStructFields("Matrix");
    expect(fieldsMap?.get("data")).toBeDefined();
    expect(fieldsMap?.get("data")?.arrayDimensions).toEqual([4, 4]);
  });
});

describe("CSymbolCollector - Edge Cases", () => {
  it("handles struct with single field", () => {
    // Note: C doesn't allow truly empty structs, so we test with minimal field
    const code = `struct Minimal { int x; };`;
    const tree = parseC(code);
    const symbolTable = new SymbolTable();
    const collector = new CSymbolCollector("test.h", symbolTable);
    const symbols = collector.collect(tree);

    expect(symbols.find((s) => s.name === "Minimal")).toBeDefined();
    expect(symbolTable.getStructFields("Minimal")?.size).toBe(1);
  });

  it("handles struct with type qualifiers", () => {
    const code = `struct Test { const int value; };`;
    const tree = parseC(code);
    const symbolTable = new SymbolTable();
    const collector = new CSymbolCollector("test.h", symbolTable);
    collector.collect(tree);

    const fieldsMap = symbolTable.getStructFields("Test");
    expect(fieldsMap?.get("value")).toBeDefined();
  });

  it("resets symbols between collect calls", () => {
    const collector = new CSymbolCollector("test.h");

    const code1 = `void foo();`;
    const tree1 = parseC(code1);
    const symbols1 = collector.collect(tree1);
    expect(symbols1).toHaveLength(1);

    const code2 = `void bar();`;
    const tree2 = parseC(code2);
    const symbols2 = collector.collect(tree2);
    expect(symbols2).toHaveLength(1);
    expect(symbols2[0].name).toBe("bar");
  });

  it("handles declaration without init declarator list", () => {
    // Just a struct declaration without variable
    const code = `struct Point { int x; };`;
    const tree = parseC(code);
    const collector = new CSymbolCollector("test.h");
    const symbols = collector.collect(tree);

    expect(symbols).toHaveLength(1);
    expect(symbols[0].kind).toBe(ESymbolKind.Struct);
  });

  it("handles static storage class", () => {
    const code = `static int privateVar;`;
    const tree = parseC(code);
    const collector = new CSymbolCollector("test.h");
    const symbols = collector.collect(tree);

    // Static variables are still collected
    expect(symbols[0].name).toBe("privateVar");
  });

  it("handles const qualifier", () => {
    const code = `const int MAX_VALUE = 100;`;
    const tree = parseC(code);
    const collector = new CSymbolCollector("test.h");
    const symbols = collector.collect(tree);

    expect(symbols[0].name).toBe("MAX_VALUE");
    expect(symbols[0].kind).toBe(ESymbolKind.Variable);
  });

  it("handles mixed declarations", () => {
    const code = `
      typedef int Int;
      struct Point { int x; int y; };
      enum Status { OK, ERROR };
      void init();
      extern int counter;
    `;
    const tree = parseC(code);
    const collector = new CSymbolCollector("test.h");
    const symbols = collector.collect(tree);

    const typedef = symbols.find((s) => s.name === "Int");
    const struct = symbols.find((s) => s.name === "Point");
    const enumSym = symbols.find(
      (s) => s.name === "Status" && s.kind === ESymbolKind.Enum,
    );
    const func = symbols.find((s) => s.name === "init");
    const variable = symbols.find((s) => s.name === "counter");

    expect(typedef?.kind).toBe(ESymbolKind.Type);
    expect(struct?.kind).toBe(ESymbolKind.Struct);
    expect(enumSym?.kind).toBe(ESymbolKind.Enum);
    expect(func?.kind).toBe(ESymbolKind.Function);
    expect(variable?.kind).toBe(ESymbolKind.Variable);
  });
});

describe("CSymbolCollector - Additional Edge Cases", () => {
  it("does not duplicate named enum as variable", () => {
    // When we have "enum Status { OK };" - Status should only be an Enum, not also a Variable
    const code = `enum Status { OK, ERROR };`;
    const tree = parseC(code);
    const collector = new CSymbolCollector("test.h");
    const symbols = collector.collect(tree);

    const enumSymbols = symbols.filter((s) => s.name === "Status");
    expect(enumSymbols).toHaveLength(1);
    expect(enumSymbols[0].kind).toBe(ESymbolKind.Enum);
  });

  it("handles typedef struct forward declaration pattern", () => {
    // Common C pattern: typedef struct Point Point; followed by struct Point { ... };
    const code = `
      struct Point;
      typedef struct Point Point;
      struct Point { int x; int y; };
    `;
    const tree = parseC(code);
    const collector = new CSymbolCollector("test.h");
    const symbols = collector.collect(tree);

    // Should have struct Point symbols and typedef Point
    const pointSymbols = symbols.filter((s) => s.name === "Point");
    // 4 symbols total:
    // - Struct from forward declaration (struct Point;)
    // - Struct from typedef's struct specifier (typedef struct Point ...)
    // - Type from typedef (... Point;)
    // - Struct from definition (struct Point { ... })
    expect(pointSymbols.length).toBe(4);

    const structSymbol = pointSymbols.find(
      (s) => s.kind === ESymbolKind.Struct,
    );
    const typeSymbol = pointSymbols.find((s) => s.kind === ESymbolKind.Type);
    expect(structSymbol).toBeDefined();
    expect(typeSymbol).toBeDefined();
  });

  it("handles struct field with anonymous struct type", () => {
    const code = `struct Outer { struct { int x; } inner; };`;
    const tree = parseC(code);
    const symbolTable = new SymbolTable();
    const collector = new CSymbolCollector("test.h", symbolTable);
    collector.collect(tree);

    const fieldsMap = symbolTable.getStructFields("Outer");
    expect(fieldsMap?.get("inner")).toBeDefined();
  });

  it("handles function returning pointer", () => {
    const code = `int* getPtr();`;
    const tree = parseC(code);
    const collector = new CSymbolCollector("test.h");
    const symbols = collector.collect(tree);

    expect(symbols[0].name).toBe("getPtr");
    expect(symbols[0].kind).toBe(ESymbolKind.Function);
  });
});

describe("CSymbolCollector - Without SymbolTable", () => {
  it("still collects symbols without symbolTable", () => {
    const code = `struct Point { int x; int y; };`;
    const tree = parseC(code);
    const collector = new CSymbolCollector("test.h"); // No symbolTable
    const symbols = collector.collect(tree);

    expect(symbols.find((s) => s.name === "Point")).toBeDefined();
  });

  it("does not crash when collecting struct fields without symbolTable", () => {
    const code = `struct Point { int x; int y; };`;
    const tree = parseC(code);
    const collector = new CSymbolCollector("test.h"); // No symbolTable
    expect(() => collector.collect(tree)).not.toThrow();
  });
});
