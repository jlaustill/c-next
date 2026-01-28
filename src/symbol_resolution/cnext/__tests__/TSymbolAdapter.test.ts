/**
 * Unit tests for TSymbolAdapter.
 * Tests conversion from TSymbol discriminated union types to flat ISymbol interface.
 */

import { describe, expect, it, beforeEach } from "vitest";
import TSymbolAdapter from "../adapters/TSymbolAdapter";
import SymbolTable from "../../SymbolTable";
import ESymbolKind from "../../../types/ESymbolKind";
import ESourceLanguage from "../../../types/ESourceLanguage";
import IBitmapSymbol from "../../types/IBitmapSymbol";
import IEnumSymbol from "../../types/IEnumSymbol";
import IStructSymbol from "../../types/IStructSymbol";
import IFunctionSymbol from "../../types/IFunctionSymbol";
import IVariableSymbol from "../../types/IVariableSymbol";
import IRegisterSymbol from "../../types/IRegisterSymbol";
import IScopeSymbol from "../../types/IScopeSymbol";

describe("TSymbolAdapter", () => {
  let symbolTable: SymbolTable;

  beforeEach(() => {
    symbolTable = new SymbolTable();
  });

  describe("convertBitmap", () => {
    it("converts IBitmapSymbol to ISymbol + BitmapField symbols", () => {
      const bitmap: IBitmapSymbol = {
        kind: ESymbolKind.Bitmap,
        name: "Status",
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
      expect(bitmapSym.kind).toBe(ESymbolKind.Bitmap);
      expect(bitmapSym.type).toBe("uint8_t");
      expect(bitmapSym.isExported).toBe(true);

      // Field symbols
      const enabledField = result.find((s) => s.name === "Status_enabled");
      expect(enabledField).toBeDefined();
      expect(enabledField!.kind).toBe(ESymbolKind.BitmapField);
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
        kind: ESymbolKind.Bitmap,
        name: "Control",
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
        kind: ESymbolKind.Enum,
        name: "Color",
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

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Color");
      expect(result[0].kind).toBe(ESymbolKind.Enum);
      expect(result[0].sourceFile).toBe("test.cnx");
      expect(result[0].sourceLine).toBe(5);
      expect(result[0].isExported).toBe(true);
    });
  });

  describe("convertStruct", () => {
    it("converts IStructSymbol to ISymbol and registers fields", () => {
      const struct: IStructSymbol = {
        kind: ESymbolKind.Struct,
        name: "Point",
        sourceFile: "test.cnx",
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
        fields: new Map([
          ["x", { type: "i32", isArray: false, isConst: false }],
          ["y", { type: "i32", isArray: false, isConst: false }],
        ]),
      };

      const result = TSymbolAdapter.toISymbols([struct], symbolTable);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Point");
      expect(result[0].kind).toBe(ESymbolKind.Struct);

      // Verify fields were registered in SymbolTable
      expect(symbolTable.getStructFieldType("Point", "x")).toBe("i32");
      expect(symbolTable.getStructFieldType("Point", "y")).toBe("i32");
    });

    it("registers array fields with dimensions", () => {
      const struct: IStructSymbol = {
        kind: ESymbolKind.Struct,
        name: "Buffer",
        sourceFile: "test.cnx",
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
        fields: new Map([
          [
            "data",
            { type: "u8", isArray: true, isConst: false, dimensions: [256] },
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
        kind: ESymbolKind.Function,
        name: "calculate",
        sourceFile: "test.cnx",
        sourceLine: 10,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
        returnType: "i32",
        visibility: "public",
        parameters: [
          { name: "a", type: "i32", isConst: false, isArray: false },
          { name: "b", type: "i32", isConst: true, isArray: false },
        ],
      };

      const result = TSymbolAdapter.toISymbols([func], symbolTable);

      // 1 function + 2 parameter symbols
      expect(result).toHaveLength(3);

      // Function symbol
      const funcSym = result[0];
      expect(funcSym.name).toBe("calculate");
      expect(funcSym.kind).toBe(ESymbolKind.Function);
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
      expect(paramA!.kind).toBe(ESymbolKind.Variable);
      expect(paramA!.type).toBe("i32");
      expect(paramA!.parent).toBe("calculate");
      expect(paramA!.isExported).toBe(false);

      const paramB = result.find((s) => s.name === "b");
      expect(paramB).toBeDefined();
    });

    it("handles array parameters with [] type suffix", () => {
      const func: IFunctionSymbol = {
        kind: ESymbolKind.Function,
        name: "processArray",
        sourceFile: "test.cnx",
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
        returnType: "void",
        visibility: "public",
        parameters: [
          {
            name: "data",
            type: "u8",
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
        kind: ESymbolKind.Variable,
        name: "counter",
        sourceFile: "test.cnx",
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
        type: "u32",
        isConst: false,
        isAtomic: false,
        isArray: false,
      };

      const result = TSymbolAdapter.toISymbols([variable], symbolTable);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("counter");
      expect(result[0].kind).toBe(ESymbolKind.Variable);
      expect(result[0].type).toBe("u32");
      expect(result[0].isConst).toBe(false);
      expect(result[0].isArray).toBe(false);
    });

    it("converts array variable with dimensions", () => {
      const variable: IVariableSymbol = {
        kind: ESymbolKind.Variable,
        name: "buffer",
        sourceFile: "test.cnx",
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
        type: "u8",
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
        kind: ESymbolKind.Variable,
        name: "MAX_SIZE",
        sourceFile: "test.cnx",
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
        type: "u32",
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
        kind: ESymbolKind.Register,
        name: "GPIO",
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
      expect(regSym.kind).toBe(ESymbolKind.Register);
      expect(regSym.isExported).toBe(true);

      // Member symbols
      const dataMember = result.find((s) => s.name === "GPIO_DATA");
      expect(dataMember).toBeDefined();
      expect(dataMember!.kind).toBe(ESymbolKind.RegisterMember);
      expect(dataMember!.type).toBe("uint32_t");
      expect(dataMember!.parent).toBe("GPIO");
      expect(dataMember!.accessModifier).toBe("rw");

      const statusMember = result.find((s) => s.name === "GPIO_STATUS");
      expect(statusMember!.accessModifier).toBe("ro");
    });
  });

  describe("convertScope", () => {
    it("converts IScopeSymbol to ISymbol", () => {
      const scope: IScopeSymbol = {
        kind: ESymbolKind.Namespace,
        name: "Motor",
        sourceFile: "test.cnx",
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
        members: ["init", "run", "stop"],
        memberVisibility: new Map([
          ["init", "public"],
          ["run", "public"],
          ["stop", "private"],
        ]),
      };

      const result = TSymbolAdapter.toISymbols([scope], symbolTable);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Motor");
      expect(result[0].kind).toBe(ESymbolKind.Namespace);
      expect(result[0].isExported).toBe(true);
    });
  });

  describe("mixed symbols", () => {
    it("handles array of different symbol types", () => {
      const symbols = [
        {
          kind: ESymbolKind.Struct,
          name: "Point",
          sourceFile: "test.cnx",
          sourceLine: 1,
          sourceLanguage: ESourceLanguage.CNext,
          isExported: true,
          fields: new Map([
            ["x", { type: "i32", isArray: false, isConst: false }],
          ]),
        } as IStructSymbol,
        {
          kind: ESymbolKind.Function,
          name: "main",
          sourceFile: "test.cnx",
          sourceLine: 5,
          sourceLanguage: ESourceLanguage.CNext,
          isExported: true,
          returnType: "void",
          visibility: "public",
          parameters: [],
        } as IFunctionSymbol,
        {
          kind: ESymbolKind.Variable,
          name: "counter",
          sourceFile: "test.cnx",
          sourceLine: 10,
          sourceLanguage: ESourceLanguage.CNext,
          isExported: true,
          type: "u32",
          isConst: false,
          isAtomic: false,
          isArray: false,
        } as IVariableSymbol,
      ];

      const result = TSymbolAdapter.toISymbols(symbols, symbolTable);

      // 1 struct + 1 function + 1 variable = 3 symbols
      expect(result).toHaveLength(3);

      const structSym = result.find((s) => s.name === "Point");
      expect(structSym!.kind).toBe(ESymbolKind.Struct);

      const funcSym = result.find((s) => s.name === "main");
      expect(funcSym!.kind).toBe(ESymbolKind.Function);

      const varSym = result.find((s) => s.name === "counter");
      expect(varSym!.kind).toBe(ESymbolKind.Variable);

      // Struct field should be registered
      expect(symbolTable.getStructFieldType("Point", "x")).toBe("i32");
    });
  });
});
