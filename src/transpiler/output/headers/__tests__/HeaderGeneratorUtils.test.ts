/**
 * Unit tests for HeaderGeneratorUtils
 */

import { describe, it, expect } from "vitest";
import HeaderGeneratorUtils from "../HeaderGeneratorUtils";
import ESymbolKind from "../../../../utils/types/ESymbolKind";
import ESourceLanguage from "../../../../utils/types/ESourceLanguage";
import ISymbol from "../../../../utils/types/ISymbol";
import IParameterSymbol from "../../../../utils/types/IParameterSymbol";

/**
 * Helper to create test symbols with required properties
 */
function makeSymbol(
  partial: Partial<ISymbol> & { name: string; kind: ESymbolKind },
): ISymbol {
  return {
    sourceFile: "test.cnx",
    sourceLine: 1,
    sourceLanguage: ESourceLanguage.CNext,
    isExported: true,
    ...partial,
  };
}

/**
 * Helper to create test parameter symbols
 */
function makeParam(
  partial: Partial<IParameterSymbol> & { name: string; type: string },
): IParameterSymbol {
  return {
    isConst: false,
    isArray: false,
    ...partial,
  };
}

describe("HeaderGeneratorUtils", () => {
  describe("makeGuard", () => {
    it("creates guard from simple filename", () => {
      expect(HeaderGeneratorUtils.makeGuard("test.h")).toBe("TEST_H");
    });

    it("creates guard from filename with path", () => {
      expect(HeaderGeneratorUtils.makeGuard("/path/to/test.h")).toBe("TEST_H");
    });

    it("creates guard with prefix", () => {
      expect(HeaderGeneratorUtils.makeGuard("test.h", "MY_PREFIX")).toBe(
        "MY_PREFIX_TEST_H",
      );
    });

    it("replaces non-alphanumeric characters with underscores", () => {
      expect(HeaderGeneratorUtils.makeGuard("my-test-file.h")).toBe(
        "MY_TEST_FILE_H",
      );
    });

    it("handles windows-style paths", () => {
      expect(HeaderGeneratorUtils.makeGuard("C:\\path\\to\\test.h")).toBe(
        "TEST_H",
      );
    });
  });

  describe("groupSymbolsByKind", () => {
    it("groups symbols correctly", () => {
      const symbols: ISymbol[] = [
        makeSymbol({ name: "MyStruct", kind: ESymbolKind.Struct }),
        makeSymbol({ name: "MyEnum", kind: ESymbolKind.Enum }),
        makeSymbol({ name: "myFunc", kind: ESymbolKind.Function }),
        makeSymbol({ name: "myVar", kind: ESymbolKind.Variable }),
        makeSymbol({ name: "MyClass", kind: ESymbolKind.Class }),
        makeSymbol({ name: "MyType", kind: ESymbolKind.Type }),
        makeSymbol({ name: "MyBitmap", kind: ESymbolKind.Bitmap }),
      ];

      const groups = HeaderGeneratorUtils.groupSymbolsByKind(symbols);

      expect(groups.structs).toHaveLength(1);
      expect(groups.structs[0].name).toBe("MyStruct");
      expect(groups.enums).toHaveLength(1);
      expect(groups.enums[0].name).toBe("MyEnum");
      expect(groups.functions).toHaveLength(1);
      expect(groups.functions[0].name).toBe("myFunc");
      expect(groups.variables).toHaveLength(1);
      expect(groups.variables[0].name).toBe("myVar");
      expect(groups.classes).toHaveLength(1);
      expect(groups.classes[0].name).toBe("MyClass");
      expect(groups.types).toHaveLength(1);
      expect(groups.types[0].name).toBe("MyType");
      expect(groups.bitmaps).toHaveLength(1);
      expect(groups.bitmaps[0].name).toBe("MyBitmap");
    });

    it("handles empty symbols array", () => {
      const groups = HeaderGeneratorUtils.groupSymbolsByKind([]);

      expect(groups.structs).toHaveLength(0);
      expect(groups.enums).toHaveLength(0);
      expect(groups.functions).toHaveLength(0);
      expect(groups.variables).toHaveLength(0);
      expect(groups.classes).toHaveLength(0);
      expect(groups.types).toHaveLength(0);
      expect(groups.bitmaps).toHaveLength(0);
    });
  });

  describe("extractBaseType", () => {
    it("extracts base type from simple type", () => {
      expect(HeaderGeneratorUtils.extractBaseType("int")).toBe("int");
    });

    it("removes pointer suffix", () => {
      expect(HeaderGeneratorUtils.extractBaseType("int*")).toBe("int");
      expect(HeaderGeneratorUtils.extractBaseType("int**")).toBe("int");
    });

    it("removes array brackets", () => {
      expect(HeaderGeneratorUtils.extractBaseType("int[10]")).toBe("int");
      expect(HeaderGeneratorUtils.extractBaseType("int[]")).toBe("int");
    });

    it("removes const prefix", () => {
      expect(HeaderGeneratorUtils.extractBaseType("const int")).toBe("int");
    });

    it("handles combined modifiers", () => {
      expect(HeaderGeneratorUtils.extractBaseType("const int*")).toBe("int");
    });
  });

  describe("isCppTemplateType", () => {
    it("returns false for undefined", () => {
      expect(HeaderGeneratorUtils.isCppTemplateType(undefined)).toBe(false);
    });

    it("returns false for C-Next string<N> types", () => {
      expect(HeaderGeneratorUtils.isCppTemplateType("string<32>")).toBe(false);
      expect(HeaderGeneratorUtils.isCppTemplateType("string<1>")).toBe(false);
      expect(HeaderGeneratorUtils.isCppTemplateType("string<256>")).toBe(false);
    });

    it("returns true for C++ template types", () => {
      expect(HeaderGeneratorUtils.isCppTemplateType("vector<int>")).toBe(true);
      expect(HeaderGeneratorUtils.isCppTemplateType("map<string, int>")).toBe(
        true,
      );
      expect(HeaderGeneratorUtils.isCppTemplateType("std::vector<int>")).toBe(
        true,
      );
    });

    it("returns true for types with angle brackets", () => {
      expect(HeaderGeneratorUtils.isCppTemplateType("Foo<Bar>")).toBe(true);
    });
  });

  describe("isMacroDimension", () => {
    it("returns false for empty string", () => {
      expect(HeaderGeneratorUtils.isMacroDimension("")).toBe(false);
    });

    it("returns false for numeric dimensions", () => {
      expect(HeaderGeneratorUtils.isMacroDimension("4")).toBe(false);
      expect(HeaderGeneratorUtils.isMacroDimension("16")).toBe(false);
      expect(HeaderGeneratorUtils.isMacroDimension("256")).toBe(false);
    });

    it("returns true for identifier dimensions", () => {
      expect(HeaderGeneratorUtils.isMacroDimension("DEVICE_COUNT")).toBe(true);
      expect(HeaderGeneratorUtils.isMacroDimension("MAX_SIZE")).toBe(true);
      expect(HeaderGeneratorUtils.isMacroDimension("NUM_LEDS")).toBe(true);
    });

    it("returns true for expression dimensions", () => {
      expect(HeaderGeneratorUtils.isMacroDimension("SIZE * 2")).toBe(true);
    });
  });

  describe("formatVariableDeclaration", () => {
    it("formats simple declaration", () => {
      expect(
        HeaderGeneratorUtils.formatVariableDeclaration("u32", "count", "", ""),
      ).toBe("uint32_t count");
    });

    it("formats declaration with const", () => {
      expect(
        HeaderGeneratorUtils.formatVariableDeclaration(
          "u32",
          "count",
          "",
          "const ",
        ),
      ).toBe("const uint32_t count");
    });

    it("formats declaration with volatile", () => {
      expect(
        HeaderGeneratorUtils.formatVariableDeclaration(
          "u32",
          "count",
          "",
          "",
          "volatile ",
        ),
      ).toBe("volatile uint32_t count");
    });

    it("formats declaration with array dimensions", () => {
      expect(
        HeaderGeneratorUtils.formatVariableDeclaration(
          "u32",
          "values",
          "[10]",
          "",
        ),
      ).toBe("uint32_t values[10]");
    });

    it("formats string<N> type with embedded dimension", () => {
      expect(
        HeaderGeneratorUtils.formatVariableDeclaration(
          "string<32>",
          "name",
          "",
          "",
        ),
      ).toBe("char name[33]");
    });

    it("formats string<N> array with additional dimensions", () => {
      expect(
        HeaderGeneratorUtils.formatVariableDeclaration(
          "string<16>",
          "labels",
          "[3]",
          "",
        ),
      ).toBe("char labels[3][17]");
    });
  });

  describe("getLocalTypeNames", () => {
    it("extracts local type names from grouped symbols", () => {
      const groups = {
        structs: [
          makeSymbol({ name: "Point", kind: ESymbolKind.Struct }),
          makeSymbol({ name: "Rect", kind: ESymbolKind.Struct }),
        ],
        classes: [] as ISymbol[],
        functions: [] as ISymbol[],
        variables: [] as ISymbol[],
        enums: [makeSymbol({ name: "Color", kind: ESymbolKind.Enum })],
        types: [makeSymbol({ name: "Size", kind: ESymbolKind.Type })],
        bitmaps: [makeSymbol({ name: "Flags", kind: ESymbolKind.Bitmap })],
      };

      const localTypes = HeaderGeneratorUtils.getLocalTypeNames(groups);

      expect(localTypes.localStructNames.has("Point")).toBe(true);
      expect(localTypes.localStructNames.has("Rect")).toBe(true);
      expect(localTypes.localEnumNames.has("Color")).toBe(true);
      expect(localTypes.localTypeNames.has("Size")).toBe(true);
      expect(localTypes.localBitmapNames.has("Flags")).toBe(true);
    });
  });

  describe("buildExternalTypeIncludes", () => {
    it("returns empty sets when no external type headers", () => {
      const externalTypes = new Set(["MyType"]);
      const result = HeaderGeneratorUtils.buildExternalTypeIncludes(
        externalTypes,
        undefined,
      );

      expect(result.typesWithHeaders.size).toBe(0);
      expect(result.headersToInclude.size).toBe(0);
    });

    it("maps external types to their headers", () => {
      const externalTypes = new Set(["TypeA", "TypeB", "TypeC"]);
      const externalTypeHeaders = new Map([
        ["TypeA", '#include "a.h"'],
        ["TypeB", '#include "b.h"'],
      ]);

      const result = HeaderGeneratorUtils.buildExternalTypeIncludes(
        externalTypes,
        externalTypeHeaders,
      );

      expect(result.typesWithHeaders.has("TypeA")).toBe(true);
      expect(result.typesWithHeaders.has("TypeB")).toBe(true);
      expect(result.typesWithHeaders.has("TypeC")).toBe(false);
      expect(result.headersToInclude.has('#include "a.h"')).toBe(true);
      expect(result.headersToInclude.has('#include "b.h"')).toBe(true);
    });
  });

  describe("collectExternalTypes", () => {
    it("collects types from function return types", () => {
      const functions: ISymbol[] = [
        makeSymbol({
          name: "getConfig",
          kind: ESymbolKind.Function,
          type: "Config",
        }),
      ];

      const result = HeaderGeneratorUtils.collectExternalTypes(
        functions,
        [],
        new Set(),
        new Set(),
        new Set(),
        new Set(),
      );

      expect(result.has("Config")).toBe(true);
    });

    it("collects types from function parameters", () => {
      const functions: ISymbol[] = [
        makeSymbol({
          name: "process",
          kind: ESymbolKind.Function,
          parameters: [makeParam({ name: "data", type: "DataPacket" })],
        }),
      ];

      const result = HeaderGeneratorUtils.collectExternalTypes(
        functions,
        [],
        new Set(),
        new Set(),
        new Set(),
        new Set(),
      );

      expect(result.has("DataPacket")).toBe(true);
    });

    it("collects types from variables", () => {
      const variables: ISymbol[] = [
        makeSymbol({
          name: "state",
          kind: ESymbolKind.Variable,
          type: "SystemState",
        }),
      ];

      const result = HeaderGeneratorUtils.collectExternalTypes(
        [],
        variables,
        new Set(),
        new Set(),
        new Set(),
        new Set(),
      );

      expect(result.has("SystemState")).toBe(true);
    });

    it("excludes local structs", () => {
      const functions: ISymbol[] = [
        makeSymbol({
          name: "getPoint",
          kind: ESymbolKind.Function,
          type: "Point",
        }),
      ];

      const result = HeaderGeneratorUtils.collectExternalTypes(
        functions,
        [],
        new Set(["Point"]),
        new Set(),
        new Set(),
        new Set(),
      );

      expect(result.has("Point")).toBe(false);
    });

    it("excludes built-in types", () => {
      const functions: ISymbol[] = [
        makeSymbol({
          name: "getValue",
          kind: ESymbolKind.Function,
          type: "u32",
        }),
      ];

      const result = HeaderGeneratorUtils.collectExternalTypes(
        functions,
        [],
        new Set(),
        new Set(),
        new Set(),
        new Set(),
      );

      expect(result.has("u32")).toBe(false);
    });

    it("excludes C++ namespace types", () => {
      const functions: ISymbol[] = [
        makeSymbol({
          name: "parse",
          kind: ESymbolKind.Function,
          type: "std::string",
        }),
      ];

      const result = HeaderGeneratorUtils.collectExternalTypes(
        functions,
        [],
        new Set(),
        new Set(),
        new Set(),
        new Set(),
      );

      expect(result.has("std::string")).toBe(false);
    });

    it("excludes known enums", () => {
      const functions: ISymbol[] = [
        makeSymbol({
          name: "getColor",
          kind: ESymbolKind.Function,
          type: "Color",
        }),
      ];

      const result = HeaderGeneratorUtils.collectExternalTypes(
        functions,
        [],
        new Set(),
        new Set(),
        new Set(),
        new Set(),
        new Set(["Color"]),
      );

      expect(result.has("Color")).toBe(false);
    });
  });

  describe("filterCCompatibleTypes", () => {
    it("excludes types with known headers", () => {
      const externalTypes = new Set(["TypeA", "TypeB"]);
      const typesWithHeaders = new Set(["TypeA"]);

      const result = HeaderGeneratorUtils.filterCCompatibleTypes(
        externalTypes,
        typesWithHeaders,
      );

      expect(result).toContain("TypeB");
      expect(result).not.toContain("TypeA");
    });

    it("excludes C++ template types", () => {
      const externalTypes = new Set(["vector<int>", "MyType"]);
      const typesWithHeaders = new Set<string>();

      const result = HeaderGeneratorUtils.filterCCompatibleTypes(
        externalTypes,
        typesWithHeaders,
      );

      expect(result).toContain("MyType");
      expect(result).not.toContain("vector<int>");
    });

    it("excludes namespace types with ::", () => {
      const externalTypes = new Set(["std::string", "MyType"]);
      const typesWithHeaders = new Set<string>();

      const result = HeaderGeneratorUtils.filterCCompatibleTypes(
        externalTypes,
        typesWithHeaders,
      );

      expect(result).toContain("MyType");
      expect(result).not.toContain("std::string");
    });

    it("excludes dot-notation namespace types", () => {
      const externalTypes = new Set(["Lib.Module.Type", "MyType"]);
      const typesWithHeaders = new Set<string>();

      const result = HeaderGeneratorUtils.filterCCompatibleTypes(
        externalTypes,
        typesWithHeaders,
      );

      expect(result).toContain("MyType");
      expect(result).not.toContain("Lib.Module.Type");
    });
  });

  describe("filterCCompatibleVariables", () => {
    it("filters out C++ namespace types", () => {
      const variables: ISymbol[] = [
        makeSymbol({
          name: "a",
          kind: ESymbolKind.Variable,
          type: "std::string",
        }),
        makeSymbol({ name: "b", kind: ESymbolKind.Variable, type: "int" }),
      ];

      const result = HeaderGeneratorUtils.filterCCompatibleVariables(variables);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("b");
    });

    it("filters out C++ template types", () => {
      const variables: ISymbol[] = [
        makeSymbol({
          name: "a",
          kind: ESymbolKind.Variable,
          type: "vector<int>",
        }),
        makeSymbol({ name: "b", kind: ESymbolKind.Variable, type: "u32" }),
      ];

      const result = HeaderGeneratorUtils.filterCCompatibleVariables(variables);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("b");
    });

    it("keeps C-Next string<N> types", () => {
      const variables: ISymbol[] = [
        makeSymbol({
          name: "name",
          kind: ESymbolKind.Variable,
          type: "string<32>",
        }),
      ];

      const result = HeaderGeneratorUtils.filterCCompatibleVariables(variables);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("name");
    });
  });

  // =========================================================================
  // Section Generator Tests
  // =========================================================================

  describe("generateHeaderStart", () => {
    it("generates header guard and comment", () => {
      const lines = HeaderGeneratorUtils.generateHeaderStart("MY_FILE_H");

      expect(lines).toContain("#ifndef MY_FILE_H");
      expect(lines).toContain("#define MY_FILE_H");
      expect(lines.some((l) => l.includes("Generated by C-Next"))).toBe(true);
    });
  });

  describe("generateIncludes", () => {
    it("generates system includes by default", () => {
      const lines = HeaderGeneratorUtils.generateIncludes({}, new Set());

      expect(lines).toContain("#include <stdint.h>");
      expect(lines).toContain("#include <stdbool.h>");
    });

    it("skips system includes when disabled", () => {
      const lines = HeaderGeneratorUtils.generateIncludes(
        { includeSystemHeaders: false },
        new Set(),
      );

      expect(lines).not.toContain("#include <stdint.h>");
    });

    it("includes user includes", () => {
      const lines = HeaderGeneratorUtils.generateIncludes(
        { userIncludes: ['#include "custom.h"'] },
        new Set(),
      );

      expect(lines).toContain('#include "custom.h"');
    });

    it("includes external type headers", () => {
      const headers = new Set(['#include "external.h"']);
      const lines = HeaderGeneratorUtils.generateIncludes({}, headers);

      expect(lines).toContain('#include "external.h"');
    });

    it("adds blank line after includes", () => {
      const lines = HeaderGeneratorUtils.generateIncludes({}, new Set());

      expect(lines[lines.length - 1]).toBe("");
    });
  });

  describe("generateCppWrapperStart", () => {
    it("generates extern C wrapper", () => {
      const lines = HeaderGeneratorUtils.generateCppWrapperStart();

      expect(lines).toContain("#ifdef __cplusplus");
      expect(lines).toContain('extern "C" {');
      expect(lines).toContain("#endif");
    });
  });

  describe("generateForwardDeclarations", () => {
    it("returns empty array for no types", () => {
      const lines = HeaderGeneratorUtils.generateForwardDeclarations([]);

      expect(lines).toHaveLength(0);
    });

    it("generates typedef struct for each type", () => {
      const lines = HeaderGeneratorUtils.generateForwardDeclarations([
        "TypeA",
        "TypeB",
      ]);

      expect(lines).toContain("typedef struct TypeA TypeA;");
      expect(lines).toContain("typedef struct TypeB TypeB;");
    });

    it("includes comment header", () => {
      const lines = HeaderGeneratorUtils.generateForwardDeclarations(["TypeA"]);

      expect(lines.some((l) => l.includes("External type dependencies"))).toBe(
        true,
      );
    });
  });

  describe("generateEnumSection", () => {
    it("returns empty array for no enums", () => {
      const lines = HeaderGeneratorUtils.generateEnumSection([]);

      expect(lines).toHaveLength(0);
    });

    it("generates placeholder when no typeInput", () => {
      const enums = [makeSymbol({ name: "Color", kind: ESymbolKind.Enum })];
      const lines = HeaderGeneratorUtils.generateEnumSection(enums);

      expect(lines.some((l) => l.includes("/* Enum: Color"))).toBe(true);
    });

    it("includes section comment", () => {
      const enums = [makeSymbol({ name: "Color", kind: ESymbolKind.Enum })];
      const lines = HeaderGeneratorUtils.generateEnumSection(enums);

      expect(lines).toContain("/* Enumerations */");
    });
  });

  describe("generateBitmapSection", () => {
    it("returns empty array for no bitmaps", () => {
      const lines = HeaderGeneratorUtils.generateBitmapSection([]);

      expect(lines).toHaveLength(0);
    });

    it("generates placeholder when no typeInput", () => {
      const bitmaps = [makeSymbol({ name: "Flags", kind: ESymbolKind.Bitmap })];
      const lines = HeaderGeneratorUtils.generateBitmapSection(bitmaps);

      expect(lines.some((l) => l.includes("/* Bitmap: Flags"))).toBe(true);
    });

    it("includes section comment", () => {
      const bitmaps = [makeSymbol({ name: "Flags", kind: ESymbolKind.Bitmap })];
      const lines = HeaderGeneratorUtils.generateBitmapSection(bitmaps);

      expect(lines).toContain("/* Bitmaps */");
    });
  });

  describe("generateTypeAliasSection", () => {
    it("returns empty array for no types", () => {
      const lines = HeaderGeneratorUtils.generateTypeAliasSection([]);

      expect(lines).toHaveLength(0);
    });

    it("generates typedef for each type alias", () => {
      const types = [
        makeSymbol({ name: "Size", kind: ESymbolKind.Type, type: "u32" }),
        makeSymbol({ name: "Handle", kind: ESymbolKind.Type, type: "u64" }),
      ];
      const lines = HeaderGeneratorUtils.generateTypeAliasSection(types);

      expect(lines).toContain("typedef uint32_t Size;");
      expect(lines).toContain("typedef uint64_t Handle;");
    });

    it("skips types without type property", () => {
      const types = [
        makeSymbol({ name: "NoType", kind: ESymbolKind.Type }),
        makeSymbol({ name: "WithType", kind: ESymbolKind.Type, type: "i32" }),
      ];
      const lines = HeaderGeneratorUtils.generateTypeAliasSection(types);

      expect(lines.some((l) => l.includes("NoType"))).toBe(false);
      expect(lines).toContain("typedef int32_t WithType;");
    });
  });

  describe("generateStructSection", () => {
    it("returns empty array for no structs or classes", () => {
      const lines = HeaderGeneratorUtils.generateStructSection([], []);

      expect(lines).toHaveLength(0);
    });

    it("generates forward declarations when no typeInput", () => {
      const structs = [makeSymbol({ name: "Point", kind: ESymbolKind.Struct })];
      const classes = [makeSymbol({ name: "Shape", kind: ESymbolKind.Class })];
      const lines = HeaderGeneratorUtils.generateStructSection(
        structs,
        classes,
      );

      expect(lines).toContain("typedef struct Point Point;");
      expect(lines).toContain("typedef struct Shape Shape;");
      expect(lines).toContain("/* Forward declarations */");
    });
  });

  describe("generateVariableSection", () => {
    it("returns empty array for no variables", () => {
      const lines = HeaderGeneratorUtils.generateVariableSection([]);

      expect(lines).toHaveLength(0);
    });

    it("generates extern declarations", () => {
      const variables = [
        makeSymbol({
          name: "counter",
          kind: ESymbolKind.Variable,
          type: "u32",
        }),
      ];
      const lines = HeaderGeneratorUtils.generateVariableSection(variables);

      expect(lines).toContain("extern uint32_t counter;");
    });

    it("includes const modifier", () => {
      const variables = [
        makeSymbol({
          name: "VERSION",
          kind: ESymbolKind.Variable,
          type: "u32",
          isConst: true,
        }),
      ];
      const lines = HeaderGeneratorUtils.generateVariableSection(variables);

      expect(lines).toContain("extern const uint32_t VERSION;");
    });

    it("includes volatile modifier for atomic", () => {
      const variables = [
        makeSymbol({
          name: "flag",
          kind: ESymbolKind.Variable,
          type: "bool",
          isAtomic: true,
        }),
      ];
      const lines = HeaderGeneratorUtils.generateVariableSection(variables);

      expect(lines).toContain("extern volatile bool flag;");
    });

    it("includes array dimensions", () => {
      const variables = [
        makeSymbol({
          name: "buffer",
          kind: ESymbolKind.Variable,
          type: "u8",
          isArray: true,
          arrayDimensions: ["64"],
        }),
      ];
      const lines = HeaderGeneratorUtils.generateVariableSection(variables);

      expect(lines).toContain("extern uint8_t buffer[64];");
    });
  });

  describe("generateHeaderEnd", () => {
    it("generates closing wrapper and guard", () => {
      const lines = HeaderGeneratorUtils.generateHeaderEnd("MY_FILE_H");

      expect(lines).toContain("#ifdef __cplusplus");
      expect(lines).toContain("}");
      expect(lines).toContain("#endif");
      expect(lines).toContain("#endif /* MY_FILE_H */");
    });
  });
});
