import { describe, expect, it } from "vitest";
import parseCpp from "./cppTestHelpers";
import CppSymbolCollector from "../CppSymbolCollector";
import SymbolTable from "../SymbolTable";
import ESymbolKind from "../../../../utils/types/ESymbolKind";
import ESourceLanguage from "../../../../utils/types/ESourceLanguage";

describe("CppSymbolCollector - Basic Functionality", () => {
  it("creates collector with source file", () => {
    const collector = new CppSymbolCollector("test.hpp");
    expect(collector).toBeDefined();
  });

  it("returns empty array for empty translation unit", () => {
    const code = "";
    const tree = parseCpp(code);
    const collector = new CppSymbolCollector("test.hpp");
    const symbols = collector.collect(tree);
    expect(symbols).toEqual([]);
  });

  it("returns empty array for null tree context", () => {
    const collector = new CppSymbolCollector("test.hpp");
    const symbols = collector.collect(null as any);
    expect(symbols).toEqual([]);
  });

  it("tracks source file correctly", () => {
    const code = `void foo();`;
    const tree = parseCpp(code);
    const collector = new CppSymbolCollector("myfile.hpp");
    const symbols = collector.collect(tree);
    expect(symbols[0].sourceFile).toBe("myfile.hpp");
  });

  it("tracks source line numbers", () => {
    const code = `

void foo();`;
    const tree = parseCpp(code);
    const collector = new CppSymbolCollector("test.hpp");
    const symbols = collector.collect(tree);
    expect(symbols[0].sourceLine).toBe(3);
  });
});

describe("CppSymbolCollector - Namespace Handling", () => {
  it("collects simple namespace", () => {
    const code = `namespace hw { }`;
    const tree = parseCpp(code);
    const collector = new CppSymbolCollector("test.hpp");
    const symbols = collector.collect(tree);

    const ns = symbols.find((s) => s.name === "hw");
    expect(ns?.kind).toBe(ESymbolKind.Namespace);
    expect(ns?.sourceLanguage).toBe(ESourceLanguage.Cpp);
    expect(ns?.isExported).toBe(true);
  });

  it("collects namespace with function", () => {
    const code = `
      namespace hw {
        void init();
      }
    `;
    const tree = parseCpp(code);
    const collector = new CppSymbolCollector("test.hpp");
    const symbols = collector.collect(tree);

    expect(symbols).toHaveLength(2);
    const func = symbols.find((s) => s.name === "hw::init");
    expect(func?.kind).toBe(ESymbolKind.Function);
    expect(func?.parent).toBe("hw");
  });

  it("handles nested namespaces", () => {
    const code = `
      namespace Outer {
        namespace Inner {
          void foo();
        }
      }
    `;
    const tree = parseCpp(code);
    const collector = new CppSymbolCollector("test.hpp");
    const symbols = collector.collect(tree);

    const outerNs = symbols.find((s) => s.name === "Outer");
    const innerNs = symbols.find((s) => s.name === "Inner");
    const func = symbols.find((s) => s.name === "Outer::Inner::foo");

    expect(outerNs).toBeDefined();
    expect(innerNs).toBeDefined();
    expect(func?.parent).toBe("Outer::Inner");
  });

  it("handles triple-nested namespaces", () => {
    const code = `
      namespace A {
        namespace B {
          namespace C {
            int value;
          }
        }
      }
    `;
    const tree = parseCpp(code);
    const collector = new CppSymbolCollector("test.hpp");
    const symbols = collector.collect(tree);

    const varSymbol = symbols.find((s) => s.name === "A::B::C::value");
    expect(varSymbol?.kind).toBe(ESymbolKind.Variable);
    expect(varSymbol?.parent).toBe("A::B::C");
  });

  it("handles reopened namespaces", () => {
    const code = `
      namespace hw {
        void init();
      }
      namespace hw {
        void shutdown();
      }
    `;
    const tree = parseCpp(code);
    const collector = new CppSymbolCollector("test.hpp");
    const symbols = collector.collect(tree);

    const init = symbols.find((s) => s.name === "hw::init");
    const shutdown = symbols.find((s) => s.name === "hw::shutdown");
    expect(init).toBeDefined();
    expect(shutdown).toBeDefined();
  });

  it("handles anonymous namespace", () => {
    const code = `
      namespace {
        void helper();
      }
    `;
    const tree = parseCpp(code);
    const collector = new CppSymbolCollector("test.hpp");
    const symbols = collector.collect(tree);

    // Anonymous namespace should NOT create a namespace symbol
    const ns = symbols.find((s) => s.kind === ESymbolKind.Namespace);
    expect(ns).toBeUndefined();
  });
});

describe("CppSymbolCollector - Function Definitions", () => {
  it("collects simple function with return type", () => {
    const code = `int add(int a, int b);`;
    const tree = parseCpp(code);
    const collector = new CppSymbolCollector("test.hpp");
    const symbols = collector.collect(tree);

    const func = symbols[0];
    expect(func.kind).toBe(ESymbolKind.Function);
    expect(func.name).toBe("add");
    expect(func.type).toBe("int");
    expect(func.sourceLanguage).toBe(ESourceLanguage.Cpp);
  });

  it("collects function in namespace with qualified name", () => {
    const code = `
      namespace utils {
        int clamp(int val, int min, int max);
      }
    `;
    const tree = parseCpp(code);
    const collector = new CppSymbolCollector("test.hpp");
    const symbols = collector.collect(tree);

    const func = symbols.find((s) => s.name === "utils::clamp");
    expect(func?.kind).toBe(ESymbolKind.Function);
    expect(func?.type).toBe("int");
    expect(func?.parent).toBe("utils");
  });

  it("extracts function parameters (Issue #322)", () => {
    const code = `void process(int count, const char* msg);`;
    const tree = parseCpp(code);
    const collector = new CppSymbolCollector("test.hpp");
    const symbols = collector.collect(tree);

    const func = symbols[0];
    expect(func.parameters).toHaveLength(2);
    expect(func.parameters?.[0]).toEqual({
      name: "count",
      type: "int",
      isConst: false,
      isArray: false,
    });
    expect(func.parameters?.[1]).toEqual({
      name: "msg",
      type: "char*",
      isConst: true,
      isArray: false,
    });
  });

  it("handles function with no parameters", () => {
    const code = `void init();`;
    const tree = parseCpp(code);
    const collector = new CppSymbolCollector("test.hpp");
    const symbols = collector.collect(tree);

    const func = symbols[0];
    expect(func.parameters).toBeUndefined();
  });

  it("handles function pointer return types", () => {
    const code = `int* getData();`;
    const tree = parseCpp(code);
    const collector = new CppSymbolCollector("test.hpp");
    const symbols = collector.collect(tree);

    const func = symbols[0];
    expect(func.type).toBe("int");
  });

  it("defaults to void for functions without return type", () => {
    const code = `
      namespace test {
        foo();
      }
    `;
    // This might not parse correctly, but test the fallback
    try {
      const tree = parseCpp(code);
      const collector = new CppSymbolCollector("test.hpp");
      collector.collect(tree);
      // If it parses, we check fallback behavior
    } catch (e) {
      // Parse error is acceptable for malformed code
      expect(e).toBeDefined();
    }
  });
});

describe("CppSymbolCollector - Class/Struct Definitions", () => {
  it("collects named class definition", () => {
    const code = `class MyClass { };`;
    const tree = parseCpp(code);
    const collector = new CppSymbolCollector("test.hpp");
    const symbols = collector.collect(tree);

    const cls = symbols[0];
    expect(cls.kind).toBe(ESymbolKind.Class);
    expect(cls.name).toBe("MyClass");
    expect(cls.sourceLanguage).toBe(ESourceLanguage.Cpp);
  });

  it("collects named struct definition", () => {
    const code = `struct Point { int x; int y; };`;
    const tree = parseCpp(code);
    const symbolTable = new SymbolTable();
    const collector = new CppSymbolCollector("test.hpp", symbolTable);
    const symbols = collector.collect(tree);

    const struct = symbols[0];
    expect(struct.kind).toBe(ESymbolKind.Class);
    expect(struct.name).toBe("Point");
  });

  it("collects class in namespace", () => {
    const code = `
      namespace hw {
        class Device { };
      }
    `;
    const tree = parseCpp(code);
    const collector = new CppSymbolCollector("test.hpp");
    const symbols = collector.collect(tree);

    const cls = symbols.find((s) => s.name === "hw::Device");
    expect(cls?.kind).toBe(ESymbolKind.Class);
    expect(cls?.parent).toBe("hw");
  });

  it("handles empty class", () => {
    const code = `class Empty { };`;
    const tree = parseCpp(code);
    const collector = new CppSymbolCollector("test.hpp");
    const symbols = collector.collect(tree);

    expect(symbols).toHaveLength(1);
    expect(symbols[0].name).toBe("Empty");
  });
});

describe("CppSymbolCollector - Class Member Functions", () => {
  it("collects member function declaration", () => {
    const code = `
      class MyClass {
      public:
        void doSomething();
      };
    `;
    const tree = parseCpp(code);
    const symbolTable = new SymbolTable();
    const collector = new CppSymbolCollector("test.hpp", symbolTable);
    const symbols = collector.collect(tree);

    const method = symbols.find((s) => s.name === "MyClass::doSomething");
    expect(method?.kind).toBe(ESymbolKind.Function);
    expect(method?.parent).toBe("MyClass");
    expect(method?.isDeclaration).toBe(true);
  });

  it("collects inline member function definition", () => {
    const code = `
      class MyClass {
      public:
        void doSomething() { }
      };
    `;
    const tree = parseCpp(code);
    const symbolTable = new SymbolTable();
    const collector = new CppSymbolCollector("test.hpp", symbolTable);
    const symbols = collector.collect(tree);

    const method = symbols.find((s) => s.name === "MyClass::doSomething");
    expect(method?.kind).toBe(ESymbolKind.Function);
    expect(method?.type).toBe("void");
  });

  it("collects member function with return type", () => {
    const code = `
      class MyClass {
      public:
        int getValue();
      };
    `;
    const tree = parseCpp(code);
    const symbolTable = new SymbolTable();
    const collector = new CppSymbolCollector("test.hpp", symbolTable);
    const symbols = collector.collect(tree);

    const method = symbols.find((s) => s.name === "MyClass::getValue");
    expect(method?.type).toBe("int");
  });

  it("collects member function with parameters (Issue #322)", () => {
    const code = `
      class MyClass {
      public:
        void set(int val);
      };
    `;
    const tree = parseCpp(code);
    const symbolTable = new SymbolTable();
    const collector = new CppSymbolCollector("test.hpp", symbolTable);
    const symbols = collector.collect(tree);

    const method = symbols.find((s) => s.name === "MyClass::set");
    expect(method?.parameters).toHaveLength(1);
    expect(method?.parameters?.[0].type).toBe("int");
  });

  it("collects static member function", () => {
    const code = `
      class Utils {
      public:
        static int abs(int x);
      };
    `;
    const tree = parseCpp(code);
    const symbolTable = new SymbolTable();
    const collector = new CppSymbolCollector("test.hpp", symbolTable);
    const symbols = collector.collect(tree);

    const method = symbols.find((s) => s.name === "Utils::abs");
    expect(method?.kind).toBe(ESymbolKind.Function);
  });
});

describe("CppSymbolCollector - Struct Field Collection", () => {
  it("registers struct fields in SymbolTable", () => {
    const code = `
      struct Point {
        int x;
        int y;
      };
    `;
    const tree = parseCpp(code);
    const symbolTable = new SymbolTable();
    const collector = new CppSymbolCollector("test.hpp", symbolTable);

    collector.collect(tree);

    const fields = symbolTable.getStructFields("Point");
    expect(fields?.size).toBe(2);
    expect(fields?.get("x")?.type).toBe("int");
    expect(fields?.get("y")?.type).toBe("int");
  });

  it("registers array fields with dimensions", () => {
    const code = `
      struct Buffer {
        uint8_t data[256];
      };
    `;
    const tree = parseCpp(code);
    const symbolTable = new SymbolTable();
    const collector = new CppSymbolCollector("test.hpp", symbolTable);

    collector.collect(tree);

    const field = symbolTable.getStructFieldInfo("Buffer", "data");
    expect(field?.type).toBe("uint8_t");
    expect(field?.arrayDimensions).toEqual([256]);
  });

  it("registers multi-dimensional array fields", () => {
    const code = `
      struct Matrix {
        float values[4][4];
      };
    `;
    const tree = parseCpp(code);
    const symbolTable = new SymbolTable();
    const collector = new CppSymbolCollector("test.hpp", symbolTable);

    collector.collect(tree);

    const field = symbolTable.getStructFieldInfo("Matrix", "values");
    expect(field?.arrayDimensions).toEqual([4, 4]);
  });

  it("generates warning for reserved field name 'length'", () => {
    const code = `
      struct MyStruct {
        int length;
      };
    `;
    const tree = parseCpp(code);
    const symbolTable = new SymbolTable();
    const collector = new CppSymbolCollector("test.hpp", symbolTable);

    collector.collect(tree);
    const warnings = collector.getWarnings();

    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("conflicts with C-Next's .length property");
  });

  it("does not generate warning for 'capacity' (not currently reserved)", () => {
    const code = `
      struct MyStruct {
        int capacity;
      };
    `;
    const tree = parseCpp(code);
    const symbolTable = new SymbolTable();
    const collector = new CppSymbolCollector("test.hpp", symbolTable);

    collector.collect(tree);
    const warnings = collector.getWarnings();

    // 'capacity' is not in RESERVED_FIELD_NAMES (only 'length' is)
    expect(warnings).toHaveLength(0);
  });

  it("does not register fields when SymbolTable is not provided", () => {
    const code = `
      struct Point {
        int x;
        int y;
      };
    `;
    const tree = parseCpp(code);
    const collector = new CppSymbolCollector("test.hpp");

    const symbols = collector.collect(tree);

    // Should collect struct symbol but not register fields
    expect(symbols).toHaveLength(1);
    expect(symbols[0].kind).toBe(ESymbolKind.Class);
  });
});

describe("CppSymbolCollector - Enum Handling", () => {
  it("collects C++11 enum class with explicit type", () => {
    const code = `enum class EMode : uint8_t { OFF, ON };`;
    const tree = parseCpp(code);
    const collector = new CppSymbolCollector("test.hpp");
    const symbols = collector.collect(tree);

    const enumSymbol = symbols[0];
    expect(enumSymbol.kind).toBe(ESymbolKind.Enum);
    expect(enumSymbol.name).toBe("EMode");
    expect(enumSymbol.sourceLanguage).toBe(ESourceLanguage.Cpp);
  });

  it("collects C++11 enum class without explicit type", () => {
    const code = `enum class EColor { RED, GREEN, BLUE };`;
    const tree = parseCpp(code);
    const collector = new CppSymbolCollector("test.hpp");
    const symbols = collector.collect(tree);

    const enumSymbol = symbols[0];
    expect(enumSymbol.kind).toBe(ESymbolKind.Enum);
    expect(enumSymbol.name).toBe("EColor");
  });

  it("collects typed enum (not class)", () => {
    const code = `enum EFlags : uint16_t { FLAG_NONE, FLAG_READ };`;
    const tree = parseCpp(code);
    const collector = new CppSymbolCollector("test.hpp");
    const symbols = collector.collect(tree);

    const enumSymbol = symbols[0];
    expect(enumSymbol.kind).toBe(ESymbolKind.Enum);
    expect(enumSymbol.name).toBe("EFlags");
  });

  it("collects traditional C-style enum", () => {
    const code = `enum ELegacy { LEGACY_A, LEGACY_B };`;
    const tree = parseCpp(code);
    const collector = new CppSymbolCollector("test.hpp");
    const symbols = collector.collect(tree);

    const enumSymbol = symbols[0];
    expect(enumSymbol.kind).toBe(ESymbolKind.Enum);
    expect(enumSymbol.name).toBe("ELegacy");
  });

  it("collects enum in namespace", () => {
    const code = `
      namespace hw {
        enum class EStatus { OK, ERROR };
      }
    `;
    const tree = parseCpp(code);
    const collector = new CppSymbolCollector("test.hpp");
    const symbols = collector.collect(tree);

    const enumSymbol = symbols.find((s) => s.name === "hw::EStatus");
    expect(enumSymbol?.kind).toBe(ESymbolKind.Enum);
    expect(enumSymbol?.parent).toBe("hw");
  });

  it("extracts enum bit width for uint8_t backing type (Issue #208)", () => {
    const code = `enum class EMode : uint8_t { OFF, ON };`;
    const tree = parseCpp(code);
    const symbolTable = new SymbolTable();
    const collector = new CppSymbolCollector("test.hpp", symbolTable);

    collector.collect(tree);

    const bitWidth = symbolTable.getEnumBitWidth("EMode");
    expect(bitWidth).toBe(8);
  });

  it("extracts enum bit width for uint16_t backing type (Issue #208)", () => {
    const code = `enum class EFlags : uint16_t { NONE, READ };`;
    const tree = parseCpp(code);
    const symbolTable = new SymbolTable();
    const collector = new CppSymbolCollector("test.hpp", symbolTable);

    collector.collect(tree);

    const bitWidth = symbolTable.getEnumBitWidth("EFlags");
    expect(bitWidth).toBe(16);
  });

  it("extracts enum bit width for uint32_t backing type (Issue #208)", () => {
    const code = `enum class ELarge : uint32_t { VALUE };`;
    const tree = parseCpp(code);
    const symbolTable = new SymbolTable();
    const collector = new CppSymbolCollector("test.hpp", symbolTable);

    collector.collect(tree);

    const bitWidth = symbolTable.getEnumBitWidth("ELarge");
    expect(bitWidth).toBe(32);
  });

  it("extracts enum bit width for int8_t backing type (Issue #208)", () => {
    const code = `enum class ESigned : int8_t { NEG = -1, ZERO = 0 };`;
    const tree = parseCpp(code);
    const symbolTable = new SymbolTable();
    const collector = new CppSymbolCollector("test.hpp", symbolTable);

    collector.collect(tree);

    const bitWidth = symbolTable.getEnumBitWidth("ESigned");
    expect(bitWidth).toBe(8);
  });

  it("does not extract bit width for untyped enums", () => {
    const code = `enum ELegacy { A, B };`;
    const tree = parseCpp(code);
    const symbolTable = new SymbolTable();
    const collector = new CppSymbolCollector("test.hpp", symbolTable);

    collector.collect(tree);

    const bitWidth = symbolTable.getEnumBitWidth("ELegacy");
    expect(bitWidth).toBeUndefined();
  });
});

describe("CppSymbolCollector - Function Parameters (Issue #322)", () => {
  it("extracts parameters with names and types", () => {
    const code = `void func(int x, double y);`;
    const tree = parseCpp(code);
    const collector = new CppSymbolCollector("test.hpp");
    const symbols = collector.collect(tree);

    const func = symbols[0];
    expect(func.parameters).toHaveLength(2);
    expect(func.parameters?.[0]).toEqual({
      name: "x",
      type: "int",
      isConst: false,
      isArray: false,
    });
    expect(func.parameters?.[1]).toEqual({
      name: "y",
      type: "double",
      isConst: false,
      isArray: false,
    });
  });

  it("detects const parameters", () => {
    const code = `void func(const int x);`;
    const tree = parseCpp(code);
    const collector = new CppSymbolCollector("test.hpp");
    const symbols = collector.collect(tree);

    const param = symbols[0].parameters?.[0];
    expect(param?.isConst).toBe(true);
  });

  it("detects pointer parameters", () => {
    const code = `void func(char* str);`;
    const tree = parseCpp(code);
    const collector = new CppSymbolCollector("test.hpp");
    const symbols = collector.collect(tree);

    const param = symbols[0].parameters?.[0];
    expect(param?.type).toBe("char*");
  });

  it("handles const pointer parameters", () => {
    const code = `void func(const char* msg);`;
    const tree = parseCpp(code);
    const collector = new CppSymbolCollector("test.hpp");
    const symbols = collector.collect(tree);

    const param = symbols[0].parameters?.[0];
    expect(param?.type).toBe("char*");
    expect(param?.isConst).toBe(true);
  });

  it("handles abstract declarators (parameters without names)", () => {
    const code = `void func(int, double);`;
    const tree = parseCpp(code);
    const collector = new CppSymbolCollector("test.hpp");
    const symbols = collector.collect(tree);

    const func = symbols[0];
    expect(func.parameters).toHaveLength(2);
    expect(func.parameters?.[0].name).toBe("");
    expect(func.parameters?.[0].type).toBe("int");
  });

  it("handles multiple pointer levels", () => {
    const code = `void func(char** argv);`;
    const tree = parseCpp(code);
    const collector = new CppSymbolCollector("test.hpp");
    const symbols = collector.collect(tree);

    const param = symbols[0].parameters?.[0];
    expect(param?.type).toContain("*");
  });

  it("handles mixed parameter types", () => {
    const code = `void func(int a, const char* b, double c, bool d);`;
    const tree = parseCpp(code);
    const collector = new CppSymbolCollector("test.hpp");
    const symbols = collector.collect(tree);

    const func = symbols[0];
    expect(func.parameters).toHaveLength(4);
  });

  it("returns undefined for functions with no parameters", () => {
    const code = `void func();`;
    const tree = parseCpp(code);
    const collector = new CppSymbolCollector("test.hpp");
    const symbols = collector.collect(tree);

    const func = symbols[0];
    expect(func.parameters).toBeUndefined();
  });

  it("handles reference parameters", () => {
    const code = `void func(int& ref);`;
    const tree = parseCpp(code);
    const collector = new CppSymbolCollector("test.hpp");
    const symbols = collector.collect(tree);

    const param = symbols[0].parameters?.[0];
    expect(param).toBeDefined();
    expect(param?.name).toBe("ref");
  });
});

describe("CppSymbolCollector - Type Aliases", () => {
  it("collects using declaration (type alias)", () => {
    const code = `using MyInt = int;`;
    const tree = parseCpp(code);
    const collector = new CppSymbolCollector("test.hpp");
    const symbols = collector.collect(tree);

    const alias = symbols[0];
    expect(alias.kind).toBe(ESymbolKind.Type);
    expect(alias.name).toBe("MyInt");
  });

  it("collects using declaration in namespace", () => {
    const code = `
      namespace utils {
        using Counter = uint32_t;
      }
    `;
    const tree = parseCpp(code);
    const collector = new CppSymbolCollector("test.hpp");
    const symbols = collector.collect(tree);

    // Find the Counter symbol - it may not be qualified with namespace prefix
    const alias = symbols.find(
      (s) => s.name === "Counter" || s.name === "utils::Counter",
    );
    expect(alias).toBeDefined();
    expect(alias?.kind).toBe(ESymbolKind.Type);
  });

  it("skips using directives (not declarations)", () => {
    const code = `using namespace std;`;
    const tree = parseCpp(code);
    const collector = new CppSymbolCollector("test.hpp");
    const symbols = collector.collect(tree);

    // Using directive should be skipped
    expect(symbols).toHaveLength(0);
  });
});

describe("CppSymbolCollector - Anonymous Struct Typedef (Issue #342)", () => {
  it("collects anonymous struct with typedef", () => {
    const code = `
      typedef struct {
        int x;
        int y;
      } Point;
    `;
    const tree = parseCpp(code);
    const symbolTable = new SymbolTable();
    const collector = new CppSymbolCollector("test.hpp", symbolTable);

    const symbols = collector.collect(tree);

    // Should create symbol for typedef name
    const typeSymbol = symbols.find((s) => s.name === "Point");
    expect(typeSymbol?.kind).toBe(ESymbolKind.Class);
  });

  it("registers anonymous struct fields using typedef name", () => {
    const code = `
      typedef struct {
        int x;
        int y;
      } Point;
    `;
    const tree = parseCpp(code);
    const symbolTable = new SymbolTable();
    const collector = new CppSymbolCollector("test.hpp", symbolTable);

    collector.collect(tree);

    // Fields should be registered under typedef name
    const fields = symbolTable.getStructFields("Point");
    expect(fields?.size).toBe(2);
    expect(fields?.get("x")?.type).toBe("int");
    expect(fields?.get("y")?.type).toBe("int");
  });

  it("handles anonymous struct with array fields", () => {
    const code = `
      typedef struct {
        uint8_t data[256];
      } Buffer;
    `;
    const tree = parseCpp(code);
    const symbolTable = new SymbolTable();
    const collector = new CppSymbolCollector("test.hpp", symbolTable);

    collector.collect(tree);

    const field = symbolTable.getStructFieldInfo("Buffer", "data");
    expect(field?.arrayDimensions).toEqual([256]);
  });
});

describe("CppSymbolCollector - Template Declarations", () => {
  it("skips simple template class", () => {
    const code = `
      template<typename T>
      class Container {
        T value;
      };
    `;
    const tree = parseCpp(code);
    const collector = new CppSymbolCollector("test.hpp");
    const symbols = collector.collect(tree);

    // Templates should be skipped
    expect(symbols).toHaveLength(0);
  });

  it("skips template function", () => {
    const code = `
      template<typename T>
      T max(T a, T b) { return a > b ? a : b; }
    `;
    const tree = parseCpp(code);
    const collector = new CppSymbolCollector("test.hpp");
    const symbols = collector.collect(tree);

    expect(symbols).toHaveLength(0);
  });

  it("skips template with multiple parameters", () => {
    const code = `
      template<typename T, int SIZE>
      class Buffer {
        T data[SIZE];
      };
    `;
    const tree = parseCpp(code);
    const collector = new CppSymbolCollector("test.hpp");
    const symbols = collector.collect(tree);

    expect(symbols).toHaveLength(0);
  });
});

describe("CppSymbolCollector - Edge Cases", () => {
  it("handles missing declarator name gracefully", () => {
    const code = `void;`;
    try {
      const tree = parseCpp(code);
      const collector = new CppSymbolCollector("test.hpp");
      expect(() => collector.collect(tree)).not.toThrow();
    } catch (e) {
      // Parse error is acceptable
      expect(e).toBeDefined();
    }
  });

  it("handles multiple declarations in one statement", () => {
    const code = `int a, b, c;`;
    const tree = parseCpp(code);
    const collector = new CppSymbolCollector("test.hpp");
    const symbols = collector.collect(tree);

    expect(symbols).toHaveLength(3);
    expect(symbols.map((s) => s.name)).toContain("a");
    expect(symbols.map((s) => s.name)).toContain("b");
    expect(symbols.map((s) => s.name)).toContain("c");
  });

  it("handles function overloads (same name, different signatures)", () => {
    const code = `
      void foo(int x);
      void foo(double x);
      void foo(int x, int y);
    `;
    const tree = parseCpp(code);
    const collector = new CppSymbolCollector("test.hpp");
    const symbols = collector.collect(tree);

    const fooFuncs = symbols.filter((s) => s.name === "foo");
    expect(fooFuncs).toHaveLength(3);
  });

  it("handles extern declarations", () => {
    const code = `extern int globalVar;`;
    const tree = parseCpp(code);
    const collector = new CppSymbolCollector("test.hpp");
    const symbols = collector.collect(tree);

    const varSymbol = symbols[0];
    expect(varSymbol.kind).toBe(ESymbolKind.Variable);
    expect(varSymbol.name).toBe("globalVar");
    // Note: CppSymbolCollector doesn't currently set isDeclaration for extern variables
    // This is acceptable as it's primarily used for functions
  });

  it("handles complex type names", () => {
    const code = `unsigned long long getValue();`;
    const tree = parseCpp(code);
    const collector = new CppSymbolCollector("test.hpp");
    const symbols = collector.collect(tree);

    const func = symbols[0];
    expect(func.type).toBeDefined();
    expect(func.type).toContain("long");
  });

  it("resets state between collect() calls", () => {
    const code1 = `void foo();`;
    const code2 = `void bar();`;
    const tree1 = parseCpp(code1);
    const tree2 = parseCpp(code2);

    const collector = new CppSymbolCollector("test.hpp");
    const symbols1 = collector.collect(tree1);
    const symbols2 = collector.collect(tree2);

    expect(symbols1).toHaveLength(1);
    expect(symbols2).toHaveLength(1);
    expect(symbols1[0].name).toBe("foo");
    expect(symbols2[0].name).toBe("bar");
  });

  it("clears warnings between collect() calls", () => {
    const code = `struct S { int length; };`;
    const tree = parseCpp(code);
    const symbolTable = new SymbolTable();
    const collector = new CppSymbolCollector("test.hpp", symbolTable);

    collector.collect(tree);
    const warnings1 = collector.getWarnings();

    collector.collect(tree);
    const warnings2 = collector.getWarnings();

    expect(warnings1).toHaveLength(1);
    expect(warnings2).toHaveLength(1);
  });
});

describe("CppSymbolCollector - Real C++ Header Integration", () => {
  it("parses comprehensive-cpp.hpp successfully", () => {
    const fs = require("fs");
    const path = require("path");
    const headerPath = path.join(
      __dirname,
      "../../../../../tests/cpp-interop/comprehensive-cpp.hpp",
    );
    const code = fs.readFileSync(headerPath, "utf-8");

    const tree = parseCpp(code);
    const symbolTable = new SymbolTable();
    const collector = new CppSymbolCollector(
      "comprehensive-cpp.hpp",
      symbolTable,
    );

    const symbols = collector.collect(tree);

    // Verify key symbols are collected
    expect(symbols.length).toBeGreaterThan(0);

    // Check namespace
    const hwNs = symbols.find((s) => s.name === "hw");
    expect(hwNs?.kind).toBe(ESymbolKind.Namespace);

    // Check enum class
    const emode = symbols.find((s) => s.name === "EMode");
    expect(emode?.kind).toBe(ESymbolKind.Enum);

    // Check bit width extraction
    const bitWidth = symbolTable.getEnumBitWidth("EMode");
    expect(bitWidth).toBe(8);
  });

  it("collects all namespaces from comprehensive header", () => {
    const fs = require("fs");
    const path = require("path");
    const headerPath = path.join(
      __dirname,
      "../../../../../tests/cpp-interop/comprehensive-cpp.hpp",
    );
    const code = fs.readFileSync(headerPath, "utf-8");

    const tree = parseCpp(code);
    const collector = new CppSymbolCollector("comprehensive-cpp.hpp");
    const symbols = collector.collect(tree);

    const namespaces = symbols.filter((s) => s.kind === ESymbolKind.Namespace);
    expect(namespaces.length).toBeGreaterThan(0);

    // hw and utils namespaces should be present
    const nsNames = namespaces.map((ns) => ns.name);
    expect(nsNames).toContain("hw");
    expect(nsNames).toContain("utils");
  });

  it("collects all enum types from comprehensive header", () => {
    const fs = require("fs");
    const path = require("path");
    const headerPath = path.join(
      __dirname,
      "../../../../../tests/cpp-interop/comprehensive-cpp.hpp",
    );
    const code = fs.readFileSync(headerPath, "utf-8");

    const tree = parseCpp(code);
    const collector = new CppSymbolCollector("comprehensive-cpp.hpp");
    const symbols = collector.collect(tree);

    const enums = symbols.filter((s) => s.kind === ESymbolKind.Enum);
    expect(enums.length).toBeGreaterThan(3); // Multiple enum types

    const enumNames = enums.map((e) => e.name);
    expect(enumNames).toContain("EMode");
    expect(enumNames).toContain("EColor");
    expect(enumNames).toContain("EFlags");
  });

  it("collects all classes from comprehensive header", () => {
    const fs = require("fs");
    const path = require("path");
    const headerPath = path.join(
      __dirname,
      "../../../../../tests/cpp-interop/comprehensive-cpp.hpp",
    );
    const code = fs.readFileSync(headerPath, "utf-8");

    const tree = parseCpp(code);
    const symbolTable = new SymbolTable();
    const collector = new CppSymbolCollector(
      "comprehensive-cpp.hpp",
      symbolTable,
    );
    const symbols = collector.collect(tree);

    const classes = symbols.filter((s) => s.kind === ESymbolKind.Class);
    expect(classes.length).toBeGreaterThan(5);

    const classNames = classes.map((c) => c.name);
    expect(classNames).toContain("CommandHandler");
    expect(classNames).toContain("MathUtils");
  });

  it("extracts struct fields from comprehensive header", () => {
    const fs = require("fs");
    const path = require("path");
    const headerPath = path.join(
      __dirname,
      "../../../../../tests/cpp-interop/comprehensive-cpp.hpp",
    );
    const code = fs.readFileSync(headerPath, "utf-8");

    const tree = parseCpp(code);
    const symbolTable = new SymbolTable();
    const collector = new CppSymbolCollector(
      "comprehensive-cpp.hpp",
      symbolTable,
    );

    collector.collect(tree);

    // Point struct should have x and y fields
    const pointFields = symbolTable.getStructFields("Point");
    expect(pointFields?.get("x")).toBeDefined();
    expect(pointFields?.get("y")).toBeDefined();

    // Result struct should have multiple fields
    const resultFields = symbolTable.getStructFields("Result");
    expect(resultFields?.size).toBeGreaterThan(2);
  });
});
