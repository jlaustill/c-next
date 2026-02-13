/**
 * Unit tests for CHeaderGenerator
 *
 * Tests C header generation with pointer-based pass-by-reference semantics.
 */

import { describe, it, expect } from "vitest";
import CHeaderGenerator from "../CHeaderGenerator";
import ISymbol from "../../../../utils/types/ISymbol";
import ESourceLanguage from "../../../../utils/types/ESourceLanguage";
import IParameterSymbol from "../../../../utils/types/IParameterSymbol";
import SymbolTable from "../../../logic/symbols/SymbolTable";

// ============================================================================
// Test Helpers
// ============================================================================

function createFunctionSymbol(
  name: string,
  returnType: string,
  parameters: IParameterSymbol[] = [],
  isExported = true,
): ISymbol {
  return {
    name,
    kind: "function",
    type: returnType,
    parameters,
    isExported,
    sourceFile: "test.cnx",
    sourceLine: 1,
    sourceLanguage: ESourceLanguage.CNext,
  };
}

function createStructSymbol(name: string, isExported = true): ISymbol {
  return {
    name,
    kind: "struct",
    type: name,
    isExported,
    sourceFile: "test.cnx",
    sourceLine: 1,
    sourceLanguage: ESourceLanguage.CNext,
  };
}

function createEnumSymbol(name: string, isExported = true): ISymbol {
  return {
    name,
    kind: "enum",
    type: name,
    isExported,
    sourceFile: "test.cnx",
    sourceLine: 1,
    sourceLanguage: ESourceLanguage.CNext,
  };
}

function createVariableSymbol(
  name: string,
  type: string,
  isExported = true,
): ISymbol {
  return {
    name,
    kind: "variable",
    type,
    isExported,
    sourceFile: "test.cnx",
    sourceLine: 1,
    sourceLanguage: ESourceLanguage.CNext,
  };
}

function createParam(
  name: string,
  type: string,
  options: Partial<IParameterSymbol> = {},
): IParameterSymbol {
  return {
    name,
    type,
    isConst: false,
    isAutoConst: false,
    isArray: false,
    ...options,
  };
}

// ============================================================================
// Tests
// ============================================================================

describe("CHeaderGenerator", () => {
  describe("generate", () => {
    it("generates header with include guard", () => {
      const generator = new CHeaderGenerator();
      const symbols: ISymbol[] = [];

      const result = generator.generate(symbols, "test.h");

      expect(result).toContain("#ifndef TEST_H");
      expect(result).toContain("#define TEST_H");
      expect(result).toContain("#endif /* TEST_H */");
    });

    it("generates header with custom guard prefix", () => {
      const generator = new CHeaderGenerator();
      const symbols: ISymbol[] = [];

      const result = generator.generate(symbols, "module.h", {
        guardPrefix: "MY_PROJECT",
      });

      expect(result).toContain("#ifndef MY_PROJECT_MODULE_H");
      expect(result).toContain("#define MY_PROJECT_MODULE_H");
    });

    it("generates extern C wrapper for C++ compatibility", () => {
      const generator = new CHeaderGenerator();
      const symbols: ISymbol[] = [];

      const result = generator.generate(symbols, "test.h");

      expect(result).toContain("#ifdef __cplusplus");
      expect(result).toContain('extern "C" {');
      expect(result).toContain("#endif");
    });

    it("generates function prototypes", () => {
      const generator = new CHeaderGenerator();
      const symbols: ISymbol[] = [createFunctionSymbol("doSomething", "void")];

      const result = generator.generate(symbols, "test.h");

      expect(result).toContain("void doSomething(void);");
    });

    it("filters to exported symbols when exportedOnly is true", () => {
      const generator = new CHeaderGenerator();
      const symbols: ISymbol[] = [
        createFunctionSymbol("publicFunc", "void", [], true),
        createFunctionSymbol("privateFunc", "void", [], false),
      ];

      const result = generator.generate(symbols, "test.h", {
        exportedOnly: true,
      });

      expect(result).toContain("publicFunc");
      expect(result).not.toContain("privateFunc");
    });

    it("includes all symbols when exportedOnly is false", () => {
      const generator = new CHeaderGenerator();
      const symbols: ISymbol[] = [
        createFunctionSymbol("publicFunc", "void", [], true),
        createFunctionSymbol("privateFunc", "void", [], false),
      ];

      const result = generator.generate(symbols, "test.h", {
        exportedOnly: false,
      });

      expect(result).toContain("publicFunc");
      expect(result).toContain("privateFunc");
    });
  });

  describe("function prototype generation", () => {
    it("generates void function with no parameters", () => {
      const generator = new CHeaderGenerator();
      const symbols: ISymbol[] = [createFunctionSymbol("init", "void")];

      const result = generator.generate(symbols, "test.h");

      expect(result).toContain("void init(void);");
    });

    it("generates function with return type", () => {
      const generator = new CHeaderGenerator();
      const symbols: ISymbol[] = [createFunctionSymbol("getValue", "u32")];

      const result = generator.generate(symbols, "test.h");

      expect(result).toContain("uint32_t getValue(void);");
    });

    it("forces main to return int", () => {
      const generator = new CHeaderGenerator();
      const symbols: ISymbol[] = [createFunctionSymbol("main", "u32")];

      const result = generator.generate(symbols, "test.h");

      expect(result).toContain("int main(void);");
    });

    it("generates function with single parameter using pointer (C semantics)", () => {
      const generator = new CHeaderGenerator();
      const symbols: ISymbol[] = [
        createFunctionSymbol("process", "void", [createParam("value", "u32")]),
      ];

      const result = generator.generate(symbols, "test.h");

      expect(result).toContain("void process(uint32_t* value);");
    });

    it("generates function with const parameter", () => {
      const generator = new CHeaderGenerator();
      const symbols: ISymbol[] = [
        createFunctionSymbol("process", "void", [
          createParam("value", "u32", { isConst: true }),
        ]),
      ];

      const result = generator.generate(symbols, "test.h");

      expect(result).toContain("void process(const uint32_t* value);");
    });

    it("generates function with auto-const parameter", () => {
      const generator = new CHeaderGenerator();
      const symbols: ISymbol[] = [
        createFunctionSymbol("process", "void", [
          createParam("value", "u32", { isAutoConst: true }),
        ]),
      ];

      const result = generator.generate(symbols, "test.h");

      expect(result).toContain("void process(const uint32_t* value);");
    });

    it("generates function with multiple parameters", () => {
      const generator = new CHeaderGenerator();
      const symbols: ISymbol[] = [
        createFunctionSymbol("add", "u32", [
          createParam("a", "u32"),
          createParam("b", "u32"),
        ]),
      ];

      const result = generator.generate(symbols, "test.h");

      expect(result).toContain("uint32_t add(uint32_t* a, uint32_t* b);");
    });

    it("uses pass-by-value for parameters in passByValueParams", () => {
      const generator = new CHeaderGenerator();
      const symbols: ISymbol[] = [
        createFunctionSymbol("process", "void", [createParam("value", "u32")]),
      ];
      const passByValueParams = new Map([["process", new Set(["value"])]]);

      const result = generator.generate(
        symbols,
        "test.h",
        {},
        undefined,
        passByValueParams,
      );

      expect(result).toContain("void process(uint32_t value);");
    });

    it("uses pass-by-value for float types (f32)", () => {
      const generator = new CHeaderGenerator();
      const symbols: ISymbol[] = [
        createFunctionSymbol("setFloat", "void", [createParam("value", "f32")]),
      ];

      const result = generator.generate(symbols, "test.h");

      expect(result).toContain("void setFloat(float value);");
    });

    it("uses pass-by-value for float types (f64)", () => {
      const generator = new CHeaderGenerator();
      const symbols: ISymbol[] = [
        createFunctionSymbol("setDouble", "void", [
          createParam("value", "f64"),
        ]),
      ];

      const result = generator.generate(symbols, "test.h");

      expect(result).toContain("void setDouble(double value);");
    });

    it("uses pass-by-value for enum types", () => {
      const generator = new CHeaderGenerator();
      const symbols: ISymbol[] = [
        createFunctionSymbol("setState", "void", [
          createParam("state", "State"),
        ]),
      ];
      const allKnownEnums = new Set(["State"]);

      const result = generator.generate(
        symbols,
        "test.h",
        {},
        undefined,
        undefined,
        allKnownEnums,
      );

      expect(result).toContain("void setState(State state);");
    });

    it("uses pass-by-value for ISR type (function pointer)", () => {
      const generator = new CHeaderGenerator();
      const symbols: ISymbol[] = [
        createFunctionSymbol("setHandler", "void", [
          createParam("handler", "ISR"),
        ]),
      ];

      const result = generator.generate(symbols, "test.h");

      expect(result).toContain("void setHandler(ISR handler);");
    });

    it("generates array parameter with dimensions", () => {
      const generator = new CHeaderGenerator();
      const symbols: ISymbol[] = [
        createFunctionSymbol("processArray", "void", [
          createParam("data", "u8", { isArray: true, arrayDimensions: ["10"] }),
        ]),
      ];

      const result = generator.generate(symbols, "test.h");

      expect(result).toContain("void processArray(uint8_t data[10]);");
    });

    it("generates const array parameter", () => {
      const generator = new CHeaderGenerator();
      const symbols: ISymbol[] = [
        createFunctionSymbol("readArray", "void", [
          createParam("data", "u8", {
            isConst: true,
            isArray: true,
            arrayDimensions: ["10"],
          }),
        ]),
      ];

      const result = generator.generate(symbols, "test.h");

      expect(result).toContain("void readArray(const uint8_t data[10]);");
    });

    it("generates auto-const array parameter", () => {
      const generator = new CHeaderGenerator();
      const symbols: ISymbol[] = [
        createFunctionSymbol("readArray", "void", [
          createParam("data", "u8", {
            isAutoConst: true,
            isArray: true,
            arrayDimensions: ["10"],
          }),
        ]),
      ];

      const result = generator.generate(symbols, "test.h");

      expect(result).toContain("void readArray(const uint8_t data[10]);");
    });

    it("generates string array parameter as char*", () => {
      const generator = new CHeaderGenerator();
      const symbols: ISymbol[] = [
        createFunctionSymbol("processStrings", "void", [
          createParam("strings", "string", {
            isArray: true,
            arrayDimensions: ["5"],
          }),
        ]),
      ];

      const result = generator.generate(symbols, "test.h");

      expect(result).toContain("void processStrings(char* strings[5]);");
    });

    it("generates multi-dimensional array parameter", () => {
      const generator = new CHeaderGenerator();
      const symbols: ISymbol[] = [
        createFunctionSymbol("processMatrix", "void", [
          createParam("matrix", "u32", {
            isArray: true,
            arrayDimensions: ["3", "4"],
          }),
        ]),
      ];

      const result = generator.generate(symbols, "test.h");

      expect(result).toContain("void processMatrix(uint32_t matrix[3][4]);");
    });

    it("generates function with no return type as void", () => {
      const generator = new CHeaderGenerator();
      const symbols: ISymbol[] = [
        {
          name: "noReturn",
          kind: "function",
          type: undefined,
          isExported: true,
          sourceFile: "test.cnx",
          sourceLine: 1,
          sourceLanguage: ESourceLanguage.CNext,
        },
      ];

      const result = generator.generate(symbols, "test.h");

      expect(result).toContain("void noReturn(void);");
    });
  });

  describe("type mapping", () => {
    it("maps C-Next integer types to C types", () => {
      const generator = new CHeaderGenerator();
      const types = [
        { cnx: "u8", c: "uint8_t" },
        { cnx: "u16", c: "uint16_t" },
        { cnx: "u32", c: "uint32_t" },
        { cnx: "u64", c: "uint64_t" },
        { cnx: "i8", c: "int8_t" },
        { cnx: "i16", c: "int16_t" },
        { cnx: "i32", c: "int32_t" },
        { cnx: "i64", c: "int64_t" },
      ];

      for (const { cnx, c } of types) {
        const symbols: ISymbol[] = [createFunctionSymbol("get", cnx)];
        const result = generator.generate(symbols, "test.h");
        expect(result).toContain(`${c} get(void);`);
      }
    });

    it("maps bool type", () => {
      const generator = new CHeaderGenerator();
      const symbols: ISymbol[] = [createFunctionSymbol("isReady", "bool")];

      const result = generator.generate(symbols, "test.h");

      expect(result).toContain("bool isReady(void);");
    });

    it("maps float types", () => {
      const generator = new CHeaderGenerator();
      const symbols: ISymbol[] = [
        createFunctionSymbol("getF32", "f32"),
        createFunctionSymbol("getF64", "f64"),
      ];

      const result = generator.generate(symbols, "test.h");

      expect(result).toContain("float getF32(void);");
      expect(result).toContain("double getF64(void);");
    });
  });

  describe("C-compatible filtering", () => {
    it("filters out C++ namespace types from forward declarations", () => {
      const generator = new CHeaderGenerator();
      const symbols: ISymbol[] = [
        createFunctionSymbol("process", "void", [
          createParam("result", "MockLib::Parse::ParseResult"),
        ]),
      ];

      const result = generator.generate(symbols, "test.h");

      // Should not generate struct forward declaration for C++ namespace type
      // (the type still appears in function prototype, but not in forward decl)
      expect(result).not.toContain(
        "typedef struct MockLib::Parse::ParseResult",
      );
    });

    it("filters out C++ template types from variables", () => {
      const generator = new CHeaderGenerator();
      const symbols: ISymbol[] = [
        createVariableSymbol("myVector", "std::vector<int>"),
      ];

      const result = generator.generate(symbols, "test.h");

      // Should not include the variable with C++ template type
      expect(result).not.toContain("std::vector");
    });

    it("generates forward declarations for C-compatible external types", () => {
      const generator = new CHeaderGenerator();
      const symbols: ISymbol[] = [
        createFunctionSymbol("getConfig", "void", [
          createParam("config", "ExternalConfig"),
        ]),
      ];

      const result = generator.generate(symbols, "test.h");

      expect(result).toContain("typedef struct ExternalConfig ExternalConfig;");
    });

    it("does not forward-declare locally defined structs", () => {
      const generator = new CHeaderGenerator();
      const symbols: ISymbol[] = [
        createStructSymbol("LocalStruct"),
        createFunctionSymbol("getStruct", "void", [
          createParam("s", "LocalStruct"),
        ]),
      ];

      const result = generator.generate(symbols, "test.h");

      // LocalStruct should appear in struct definitions, not external dependencies
      expect(result).not.toContain("External type dependencies");
    });

    it("does not forward-declare cross-file enums", () => {
      const generator = new CHeaderGenerator();
      const symbols: ISymbol[] = [
        createFunctionSymbol("setState", "void", [
          createParam("state", "CrossFileState"),
        ]),
      ];
      const allKnownEnums = new Set(["CrossFileState"]);

      const result = generator.generate(
        symbols,
        "test.h",
        {},
        undefined,
        undefined,
        allKnownEnums,
      );

      // Should not generate struct forward declaration for enums
      expect(result).not.toContain(
        "typedef struct CrossFileState CrossFileState;",
      );
    });

    it("filters variables with namespace underscore format types using symbol table", () => {
      const generator = new CHeaderGenerator();
      const symbolTable = new SymbolTable();
      // Register a C++ namespace symbol to make MyLib_MyClass appear as namespace type
      symbolTable.addSymbol({
        name: "MyLib",
        kind: "namespace",
        type: "namespace",
        isExported: true,
        sourceFile: "MyLib.hpp",
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.Cpp,
      });

      const symbols: ISymbol[] = [
        createVariableSymbol("instance", "MyLib_MyClass"),
      ];

      const typeInput = {
        symbolTable,
        enumMembers: new Map(),
        structFields: new Map(),
        structFieldDimensions: new Map(),
        bitmapBackingType: new Map(),
        bitmapFields: new Map(),
      };

      const result = generator.generate(symbols, "test.h", {}, typeInput);

      // Variable with underscore-format namespace type should be filtered
      expect(result).not.toContain("MyLib_MyClass instance");
    });

    it("filters external types with underscore format using symbol table", () => {
      const generator = new CHeaderGenerator();
      const symbolTable = new SymbolTable();
      // Register a C++ namespace symbol
      symbolTable.addSymbol({
        name: "LibName",
        kind: "namespace",
        type: "namespace",
        isExported: true,
        sourceFile: "LibName.hpp",
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.Cpp,
      });

      const symbols: ISymbol[] = [
        createFunctionSymbol("process", "void", [
          createParam("obj", "LibName_Object"),
        ]),
      ];

      const typeInput = {
        symbolTable,
        enumMembers: new Map(),
        structFields: new Map(),
        structFieldDimensions: new Map(),
        bitmapBackingType: new Map(),
        bitmapFields: new Map(),
      };

      const result = generator.generate(symbols, "test.h", {}, typeInput);

      // Should not forward-declare underscore-format namespace types
      expect(result).not.toContain("typedef struct LibName_Object");
    });

    it("includes external type headers when specified", () => {
      const generator = new CHeaderGenerator();
      const symbols: ISymbol[] = [
        createFunctionSymbol("getConfig", "void", [
          createParam("config", "ExternalConfig"),
        ]),
      ];
      const externalTypeHeaders = new Map([
        ["ExternalConfig", '#include "external_config.h"'],
      ]);

      const result = generator.generate(symbols, "test.h", {
        externalTypeHeaders,
      });

      expect(result).toContain('#include "external_config.h"');
      // Should not generate forward declaration since header is included
      expect(result).not.toContain(
        "typedef struct ExternalConfig ExternalConfig;",
      );
    });
  });

  describe("empty inputs", () => {
    it("generates valid header with no functions", () => {
      const generator = new CHeaderGenerator();
      const symbols: ISymbol[] = [];

      const result = generator.generate(symbols, "empty.h");

      expect(result).toContain("#ifndef EMPTY_H");
      expect(result).toContain("#define EMPTY_H");
      expect(result).toContain("#endif /* EMPTY_H */");
      expect(result).not.toContain("Function prototypes");
    });
  });

  describe("variable declarations", () => {
    it("generates extern variable declarations", () => {
      const generator = new CHeaderGenerator();
      const symbols: ISymbol[] = [createVariableSymbol("counter", "u32")];

      const result = generator.generate(symbols, "test.h");

      expect(result).toContain("External variables");
      expect(result).toContain("uint32_t");
      expect(result).toContain("counter");
    });

    it("filters out variables with dot notation types", () => {
      const generator = new CHeaderGenerator();
      const symbols: ISymbol[] = [
        createVariableSymbol("instance", "MyModule.Config"),
      ];

      const result = generator.generate(symbols, "test.h");

      expect(result).not.toContain("MyModule.Config");
    });
  });

  describe("struct and enum sections", () => {
    it("generates struct section with typeInput", () => {
      const generator = new CHeaderGenerator();
      const symbols: ISymbol[] = [createStructSymbol("Point")];

      // Create field maps in the correct format
      const pointFieldTypes = new Map<string, string>([
        ["x", "i32"],
        ["y", "i32"],
      ]);

      const typeInput = {
        symbolTable: new SymbolTable(),
        enumMembers: new Map(),
        structFields: new Map([["Point", pointFieldTypes]]),
        structFieldDimensions: new Map([["Point", new Map()]]),
        bitmapBackingType: new Map(),
        bitmapFields: new Map(),
      };

      const result = generator.generate(symbols, "test.h", {}, typeInput);

      expect(result).toContain("Struct definitions");
      expect(result).toContain("Point");
    });

    it("generates forward declarations without typeInput", () => {
      const generator = new CHeaderGenerator();
      const symbols: ISymbol[] = [createStructSymbol("Point")];

      const result = generator.generate(symbols, "test.h");

      expect(result).toContain("typedef struct Point Point;");
    });

    it("generates enum section", () => {
      const generator = new CHeaderGenerator();
      const symbols: ISymbol[] = [createEnumSymbol("Status")];

      const result = generator.generate(symbols, "test.h");

      expect(result).toContain("Enumerations");
      expect(result).toContain("Status");
    });
  });
});
