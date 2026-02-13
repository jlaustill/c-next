/**
 * Unit tests for TSymbolAdapter.
 * Tests conversion from TSymbol discriminated union types to flat ISymbol interface.
 */

import { describe, expect, it, beforeEach } from "vitest";
import TSymbolAdapter from "../adapters/TSymbolAdapter";
import SymbolTable from "../../SymbolTable";
import ESourceLanguage from "../../../../../utils/types/ESourceLanguage";
import IBitmapSymbol from "../../../../types/symbols/IBitmapSymbol";
import IEnumSymbol from "../../../../types/symbols/IEnumSymbol";
import IStructSymbol from "../../../../types/symbols/IStructSymbol";
import IFunctionSymbol from "../../../../types/symbols/IFunctionSymbol";
import IVariableSymbol from "../../../../types/symbols/IVariableSymbol";
import IRegisterSymbol from "../../../../types/symbols/IRegisterSymbol";
import IScopeSymbol from "../../../../types/symbols/IScopeSymbol";
import TypeResolver from "../../../../types/TypeResolver";
import TestScopeUtils from "./testUtils";

describe("TSymbolAdapter", () => {
  let symbolTable: SymbolTable;
  let globalScope: IScopeSymbol;

  beforeEach(() => {
    symbolTable = new SymbolTable();
    globalScope = TestScopeUtils.getGlobalScope();
  });

  describe("convertBitmap", () => {
    it("converts IBitmapSymbol to ISymbol + BitmapField symbols", () => {
      const bitmap: IBitmapSymbol = {
        kind: "bitmap",
        name: "Status",
        scope: globalScope,
        sourceFile: "test.cnx",
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
        backingType: "uint8_t",
        bitWidth: 8,
        fields: new Map([
          ["enabled", { offset: 0, width: 1 }],
          ["ready", { offset: 1, width: 1 }],
          ["error", { offset: 2, width: 1 }],
          ["reserved", { offset: 3, width: 5 }],
        ]),
      };

      const result = TSymbolAdapter.toISymbols([bitmap], symbolTable);

      // Should have 1 bitmap + 4 fields = 5 symbols
      expect(result).toHaveLength(5);

      // Main bitmap symbol
      const bitmapSym = result[0];
      expect(bitmapSym.name).toBe("Status");
      expect(bitmapSym.kind).toBe("bitmap");
      expect(bitmapSym.type).toBe("uint8_t");
      expect(bitmapSym.isExported).toBe(true);

      // Field symbols
      const enabledField = result.find((s) => s.name === "Status_enabled");
      expect(enabledField).toBeDefined();
      expect(enabledField!.kind).toBe("bitmap_field");
      expect(enabledField!.type).toBe("bool");
      expect(enabledField!.parent).toBe("Status");
      expect(enabledField!.signature).toBe("bit 0 (1 bit)");

      const reservedField = result.find((s) => s.name === "Status_reserved");
      expect(reservedField).toBeDefined();
      expect(reservedField!.type).toBe("u8");
      expect(reservedField!.signature).toBe("bits 3-7 (5 bits)");
    });

    it("uses correct type for multi-bit fields", () => {
      const bitmap: IBitmapSymbol = {
        kind: "bitmap",
        name: "Control",
        scope: globalScope,
        sourceFile: "test.cnx",
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
        backingType: "uint32_t",
        bitWidth: 32,
        fields: new Map([
          ["small", { offset: 0, width: 4 }],
          ["medium", { offset: 4, width: 12 }],
          ["large", { offset: 16, width: 16 }],
        ]),
      };

      const result = TSymbolAdapter.toISymbols([bitmap], symbolTable);

      const smallField = result.find((s) => s.name === "Control_small");
      expect(smallField!.type).toBe("u8"); // <= 8 bits

      const mediumField = result.find((s) => s.name === "Control_medium");
      expect(mediumField!.type).toBe("u16"); // <= 16 bits

      const largeField = result.find((s) => s.name === "Control_large");
      expect(largeField!.type).toBe("u16"); // exactly 16 bits
    });
  });

  describe("convertEnum", () => {
    it("converts IEnumSymbol to ISymbol", () => {
      const enumSym: IEnumSymbol = {
        kind: "enum",
        name: "Color",
        scope: globalScope,
        sourceFile: "test.cnx",
        sourceLine: 5,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
        members: new Map([
          ["Red", 0],
          ["Green", 1],
          ["Blue", 2],
        ]),
      };

      const result = TSymbolAdapter.toISymbols([enumSym], symbolTable);

      // 1 enum + 3 members
      expect(result).toHaveLength(4);
      expect(result[0].name).toBe("Color");
      expect(result[0].kind).toBe("enum");
      expect(result[0].sourceFile).toBe("test.cnx");
      expect(result[0].sourceLine).toBe(5);
      expect(result[0].isExported).toBe(true);

      // Enum members
      expect(result[1].name).toBe("Red");
      expect(result[1].kind).toBe("enum_member");
      expect(result[1].type).toBe("0");
      expect(result[1].parent).toBe("Color");

      expect(result[2].name).toBe("Green");
      expect(result[2].kind).toBe("enum_member");
      expect(result[2].type).toBe("1");

      expect(result[3].name).toBe("Blue");
      expect(result[3].kind).toBe("enum_member");
      expect(result[3].type).toBe("2");
    });
  });

  describe("convertStruct", () => {
    it("converts IStructSymbol to ISymbol and registers fields", () => {
      const struct: IStructSymbol = {
        kind: "struct",
        name: "Point",
        scope: globalScope,
        sourceFile: "test.cnx",
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
        fields: new Map([
          [
            "x",
            {
              name: "x",
              type: TypeResolver.resolve("i32"),
              isArray: false,
              isConst: false,
              isAtomic: false,
            },
          ],
          [
            "y",
            {
              name: "y",
              type: TypeResolver.resolve("i32"),
              isArray: false,
              isConst: false,
              isAtomic: false,
            },
          ],
        ]),
      };

      const result = TSymbolAdapter.toISymbols([struct], symbolTable);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Point");
      expect(result[0].kind).toBe("struct");

      // Verify fields were registered in SymbolTable
      expect(symbolTable.getStructFieldType("Point", "x")).toBe("i32");
      expect(symbolTable.getStructFieldType("Point", "y")).toBe("i32");
    });

    it("registers array fields with dimensions", () => {
      const struct: IStructSymbol = {
        kind: "struct",
        name: "Buffer",
        scope: globalScope,
        sourceFile: "test.cnx",
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
        fields: new Map([
          [
            "data",
            {
              name: "data",
              type: TypeResolver.resolve("u8"),
              isArray: true,
              isConst: false,
              isAtomic: false,
              dimensions: [256],
            },
          ],
        ]),
      };

      const result = TSymbolAdapter.toISymbols([struct], symbolTable);

      expect(result).toHaveLength(1);

      const fieldInfo = symbolTable.getStructFieldInfo("Buffer", "data");
      expect(fieldInfo).toBeDefined();
      expect(fieldInfo!.type).toBe("u8");
      expect(fieldInfo!.arrayDimensions).toEqual([256]);
    });
  });

  describe("convertFunction", () => {
    it("converts IFunctionSymbol to ISymbol + parameter symbols", () => {
      const func: IFunctionSymbol = {
        kind: "function",
        name: "calculate",
        scope: globalScope,
        body: null,
        sourceFile: "test.cnx",
        sourceLine: 10,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
        returnType: TypeResolver.resolve("i32"),
        visibility: "public",
        parameters: [
          {
            name: "a",
            type: TypeResolver.resolve("i32"),
            isConst: false,
            isArray: false,
          },
          {
            name: "b",
            type: TypeResolver.resolve("i32"),
            isConst: true,
            isArray: false,
          },
        ],
      };

      const result = TSymbolAdapter.toISymbols([func], symbolTable);

      // 1 function + 2 parameter symbols
      expect(result).toHaveLength(3);

      // Function symbol
      const funcSym = result[0];
      expect(funcSym.name).toBe("calculate");
      expect(funcSym.kind).toBe("function");
      expect(funcSym.type).toBe("i32");
      expect(funcSym.signature).toBe("i32 calculate(i32, i32)");
      expect(funcSym.parameters).toHaveLength(2);
      expect(funcSym.parameters![0]).toEqual({
        name: "a",
        type: "i32",
        isConst: false,
        isArray: false,
        arrayDimensions: undefined,
        isAutoConst: undefined,
      });

      // Parameter symbols
      const paramA = result.find((s) => s.name === "a");
      expect(paramA).toBeDefined();
      expect(paramA!.kind).toBe("variable");
      expect(paramA!.type).toBe("i32");
      expect(paramA!.parent).toBe("calculate");
      expect(paramA!.isExported).toBe(false);

      const paramB = result.find((s) => s.name === "b");
      expect(paramB).toBeDefined();
    });

    it("handles array parameters with [] type suffix", () => {
      const func: IFunctionSymbol = {
        kind: "function",
        name: "processArray",
        scope: globalScope,
        body: null,
        sourceFile: "test.cnx",
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
        returnType: TypeResolver.resolve("void"),
        visibility: "public",
        parameters: [
          {
            name: "data",
            type: TypeResolver.resolve("u8"),
            isConst: false,
            isArray: true,
            arrayDimensions: ["10"],
          },
        ],
      };

      const result = TSymbolAdapter.toISymbols([func], symbolTable);

      const paramData = result.find((s) => s.name === "data");
      expect(paramData!.type).toBe("u8[]");
    });
  });

  describe("convertVariable", () => {
    it("converts simple variable", () => {
      const variable: IVariableSymbol = {
        kind: "variable",
        name: "counter",
        scope: globalScope,
        sourceFile: "test.cnx",
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
        type: TypeResolver.resolve("u32"),
        isConst: false,
        isAtomic: false,
        isArray: false,
      };

      const result = TSymbolAdapter.toISymbols([variable], symbolTable);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("counter");
      expect(result[0].kind).toBe("variable");
      expect(result[0].type).toBe("u32");
      expect(result[0].isConst).toBe(false);
      expect(result[0].isArray).toBe(false);
    });

    it("converts array variable with dimensions", () => {
      const variable: IVariableSymbol = {
        kind: "variable",
        name: "buffer",
        scope: globalScope,
        sourceFile: "test.cnx",
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
        type: TypeResolver.resolve("u8"),
        isConst: false,
        isAtomic: false,
        isArray: true,
        arrayDimensions: [256],
      };

      const result = TSymbolAdapter.toISymbols([variable], symbolTable);

      expect(result).toHaveLength(1);
      expect(result[0].isArray).toBe(true);
      expect(result[0].arrayDimensions).toEqual(["256"]);
      expect(result[0].size).toBe(256);
    });

    it("converts const variable", () => {
      const variable: IVariableSymbol = {
        kind: "variable",
        name: "MAX_SIZE",
        scope: globalScope,
        sourceFile: "test.cnx",
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
        type: TypeResolver.resolve("u32"),
        isConst: true,
        isAtomic: false,
        isArray: false,
      };

      const result = TSymbolAdapter.toISymbols([variable], symbolTable);

      expect(result[0].isConst).toBe(true);
    });
  });

  describe("convertRegister", () => {
    it("converts IRegisterSymbol to ISymbol + RegisterMember symbols", () => {
      const register: IRegisterSymbol = {
        kind: "register",
        name: "GPIO",
        scope: globalScope,
        sourceFile: "test.cnx",
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
        baseAddress: "0x40000000",
        members: new Map([
          ["DATA", { offset: "0x00", cType: "uint32_t", access: "rw" }],
          ["DIR", { offset: "0x04", cType: "uint32_t", access: "rw" }],
          ["STATUS", { offset: "0x08", cType: "uint32_t", access: "ro" }],
        ]),
      };

      const result = TSymbolAdapter.toISymbols([register], symbolTable);

      // 1 register + 3 members = 4 symbols
      expect(result).toHaveLength(4);

      // Register symbol
      const regSym = result[0];
      expect(regSym.name).toBe("GPIO");
      expect(regSym.kind).toBe("register");
      expect(regSym.isExported).toBe(true);

      // Member symbols
      const dataMember = result.find((s) => s.name === "GPIO_DATA");
      expect(dataMember).toBeDefined();
      expect(dataMember!.kind).toBe("register_member");
      expect(dataMember!.type).toBe("uint32_t");
      expect(dataMember!.parent).toBe("GPIO");
      expect(dataMember!.accessModifier).toBe("rw");

      const statusMember = result.find((s) => s.name === "GPIO_STATUS");
      expect(statusMember!.accessModifier).toBe("ro");
    });
  });

  describe("convertScope", () => {
    it("converts IScopeSymbol to ISymbol", () => {
      const motorScope = TestScopeUtils.createMockScope("Motor");
      // Update memberVisibility
      (motorScope.memberVisibility as Map<string, string>).set(
        "init",
        "public",
      );
      (motorScope.memberVisibility as Map<string, string>).set("run", "public");
      (motorScope.memberVisibility as Map<string, string>).set(
        "stop",
        "private",
      );
      // Update members
      (motorScope.members as string[]).push("init", "run", "stop");

      const result = TSymbolAdapter.toISymbols([motorScope], symbolTable);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Motor");
      expect(result[0].kind).toBe("scope");
      expect(result[0].isExported).toBe(true);
    });
  });

  describe("mixed symbols", () => {
    it("handles array of different symbol types", () => {
      const symbols = [
        {
          kind: "struct",
          name: "Point",
          scope: globalScope,
          sourceFile: "test.cnx",
          sourceLine: 1,
          sourceLanguage: ESourceLanguage.CNext,
          isExported: true,
          fields: new Map([
            [
              "x",
              {
                name: "x",
                type: TypeResolver.resolve("i32"),
                isArray: false,
                isConst: false,
                isAtomic: false,
              },
            ],
          ]),
        } as IStructSymbol,
        {
          kind: "function",
          name: "main",
          scope: globalScope,
          body: null,
          sourceFile: "test.cnx",
          sourceLine: 5,
          sourceLanguage: ESourceLanguage.CNext,
          isExported: true,
          returnType: TypeResolver.resolve("void"),
          visibility: "public",
          parameters: [],
        } as IFunctionSymbol,
        {
          kind: "variable",
          name: "counter",
          scope: globalScope,
          sourceFile: "test.cnx",
          sourceLine: 10,
          sourceLanguage: ESourceLanguage.CNext,
          isExported: true,
          type: TypeResolver.resolve("u32"),
          isConst: false,
          isAtomic: false,
          isArray: false,
        } as IVariableSymbol,
      ];

      const result = TSymbolAdapter.toISymbols(symbols, symbolTable);

      // 1 struct + 1 function + 1 variable = 3 symbols
      expect(result).toHaveLength(3);

      const structSym = result.find((s) => s.name === "Point");
      expect(structSym!.kind).toBe("struct");

      const funcSym = result.find((s) => s.name === "main");
      expect(funcSym!.kind).toBe("function");

      const varSym = result.find((s) => s.name === "counter");
      expect(varSym!.kind).toBe("variable");

      // Struct field should be registered
      expect(symbolTable.getStructFieldType("Point", "x")).toBe("i32");
    });
  });

  describe("array dimension conversion", () => {
    it("converts qualified enum access (dots to underscores) in variable dimensions", () => {
      const variable: IVariableSymbol = {
        kind: "variable",
        name: "DATA",
        scope: globalScope,
        sourceFile: "test.cnx",
        sourceLine: 10,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
        type: TypeResolver.resolve("u8"),
        isConst: true,
        isAtomic: false,
        isArray: true,
        arrayDimensions: ["EColor.COUNT"],
      };

      const result = TSymbolAdapter.toISymbols([variable], symbolTable);

      const varSym = result.find(
        (s) => s.kind === "variable" && s.name === "DATA",
      );
      expect(varSym).toBeDefined();
      expect(varSym!.arrayDimensions).toEqual(["EColor_COUNT"]);
    });

    it("converts qualified enum access in function parameter dimensions", () => {
      const funcSym: IFunctionSymbol = {
        kind: "function",
        name: "process",
        scope: globalScope,
        body: null,
        sourceFile: "test.cnx",
        sourceLine: 5,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
        returnType: TypeResolver.resolve("void"),
        visibility: "public",
        parameters: [
          {
            name: "buffer",
            type: TypeResolver.resolve("u8"),
            isConst: false,
            isArray: true,
            arrayDimensions: ["Size.MEDIUM"],
          },
        ],
      };

      const result = TSymbolAdapter.toISymbols([funcSym], symbolTable);

      const funcResult = result.find(
        (s) => s.kind === "function" && s.name === "process",
      );
      expect(funcResult).toBeDefined();
      expect(funcResult!.parameters).toBeDefined();
      expect(funcResult!.parameters![0].arrayDimensions).toEqual([
        "Size_MEDIUM",
      ]);
    });

    it("passes through unqualified string dimensions as-is", () => {
      const variable: IVariableSymbol = {
        kind: "variable",
        name: "DATA",
        scope: globalScope,
        sourceFile: "test.cnx",
        sourceLine: 10,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
        type: TypeResolver.resolve("u8"),
        isConst: true,
        isAtomic: false,
        isArray: true,
        arrayDimensions: ["DEVICE_COUNT"], // C macro passthrough
      };

      const result = TSymbolAdapter.toISymbols([variable], symbolTable);

      const varSym = result.find(
        (s) => s.kind === "variable" && s.name === "DATA",
      );
      expect(varSym).toBeDefined();
      expect(varSym!.arrayDimensions).toEqual(["DEVICE_COUNT"]);
    });

    it("preserves numeric array dimensions", () => {
      const variable: IVariableSymbol = {
        kind: "variable",
        name: "DATA",
        scope: globalScope,
        sourceFile: "test.cnx",
        sourceLine: 10,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
        type: TypeResolver.resolve("u8"),
        isConst: true,
        isAtomic: false,
        isArray: true,
        arrayDimensions: [256],
      };

      const result = TSymbolAdapter.toISymbols([variable], symbolTable);

      const varSym = result.find(
        (s) => s.kind === "variable" && s.name === "DATA",
      );
      expect(varSym!.arrayDimensions).toEqual(["256"]);
    });

    it("handles multi-dot qualified access (Motor.State.IDLE)", () => {
      const variable: IVariableSymbol = {
        kind: "variable",
        name: "DATA",
        scope: globalScope,
        sourceFile: "test.cnx",
        sourceLine: 10,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
        type: TypeResolver.resolve("u8"),
        isConst: true,
        isAtomic: false,
        isArray: true,
        arrayDimensions: ["Motor.State.COUNT"],
      };

      const result = TSymbolAdapter.toISymbols([variable], symbolTable);

      const varSym = result.find(
        (s) => s.kind === "variable" && s.name === "DATA",
      );
      expect(varSym!.arrayDimensions).toEqual(["Motor_State_COUNT"]);
    });
  });
});
