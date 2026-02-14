/**
 * Unit tests for HeaderSymbolAdapter
 * ADR-055 Phase 5/7: Converts TSymbol to IHeaderSymbol (ISymbol methods removed in Phase 7)
 */
import { describe, it, expect } from "vitest";
import HeaderSymbolAdapter from "../HeaderSymbolAdapter";
import IVariableSymbol from "../../../../types/symbols/IVariableSymbol";
import IFunctionSymbol from "../../../../types/symbols/IFunctionSymbol";
import IStructSymbol from "../../../../types/symbols/IStructSymbol";
import IEnumSymbol from "../../../../types/symbols/IEnumSymbol";
import IBitmapSymbol from "../../../../types/symbols/IBitmapSymbol";
import IRegisterSymbol from "../../../../types/symbols/IRegisterSymbol";
import IScopeSymbol from "../../../../types/symbols/IScopeSymbol";
import ESourceLanguage from "../../../../../utils/types/ESourceLanguage";
import TTypeUtils from "../../../../../utils/TTypeUtils";
import ScopeUtils from "../../../../../utils/ScopeUtils";

describe("HeaderSymbolAdapter", () => {
  const globalScope = ScopeUtils.createGlobalScope();
  const motorScope = ScopeUtils.createScope("Motor", globalScope);

  // ========================================================================
  // fromTSymbol - TSymbol to IHeaderSymbol Conversion
  // ========================================================================

  describe("fromTSymbol - variable", () => {
    it("should convert global variable TSymbol", () => {
      const tSymbol: IVariableSymbol = {
        kind: "variable",
        name: "counter",
        scope: globalScope,
        sourceFile: "test.cnx",
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
        type: TTypeUtils.createPrimitive("u32"),
        isConst: false,
        isAtomic: false,
        isArray: false,
      };

      const result = HeaderSymbolAdapter.fromTSymbol(tSymbol);

      expect(result.name).toBe("counter");
      expect(result.kind).toBe("variable");
      expect(result.type).toBe("u32");
      expect(result.isExported).toBe(true);
      expect(result.parent).toBeUndefined();
    });

    it("should convert scoped variable with mangled name", () => {
      const tSymbol: IVariableSymbol = {
        kind: "variable",
        name: "speed",
        scope: motorScope,
        sourceFile: "motor.cnx",
        sourceLine: 5,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
        type: TTypeUtils.createPrimitive("f32"),
        isConst: false,
        isAtomic: true,
        isArray: false,
      };

      const result = HeaderSymbolAdapter.fromTSymbol(tSymbol);

      expect(result.name).toBe("Motor_speed");
      expect(result.type).toBe("f32");
      expect(result.isAtomic).toBe(true);
      expect(result.parent).toBe("Motor");
    });

    it("should convert array variable with dimensions", () => {
      const tSymbol: IVariableSymbol = {
        kind: "variable",
        name: "buffer",
        scope: globalScope,
        sourceFile: "data.cnx",
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
        type: TTypeUtils.createPrimitive("u8"),
        isConst: false,
        isAtomic: false,
        isArray: true,
        arrayDimensions: [256, 4],
      };

      const result = HeaderSymbolAdapter.fromTSymbol(tSymbol);

      expect(result.isArray).toBe(true);
      expect(result.arrayDimensions).toEqual(["256", "4"]);
    });

    it("should convert const variable", () => {
      const tSymbol: IVariableSymbol = {
        kind: "variable",
        name: "MAX_SIZE",
        scope: globalScope,
        sourceFile: "config.cnx",
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
        type: TTypeUtils.createPrimitive("u32"),
        isConst: true,
        isAtomic: false,
        isArray: false,
      };

      const result = HeaderSymbolAdapter.fromTSymbol(tSymbol);

      expect(result.isConst).toBe(true);
    });
  });

  describe("fromTSymbol - function", () => {
    it("should convert global function TSymbol", () => {
      const tSymbol: IFunctionSymbol = {
        kind: "function",
        name: "init",
        scope: globalScope,
        sourceFile: "main.cnx",
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
        parameters: [],
        returnType: TTypeUtils.createPrimitive("void"),
        visibility: "public",
        body: null,
      };

      const result = HeaderSymbolAdapter.fromTSymbol(tSymbol);

      expect(result.name).toBe("init");
      expect(result.kind).toBe("function");
      expect(result.type).toBe("void");
      expect(result.parameters).toEqual([]);
      expect(result.signature).toBe("void init()");
    });

    it("should convert scoped function with parameters", () => {
      const tSymbol: IFunctionSymbol = {
        kind: "function",
        name: "setSpeed",
        scope: motorScope,
        sourceFile: "motor.cnx",
        sourceLine: 10,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
        parameters: [
          {
            name: "value",
            type: TTypeUtils.createPrimitive("f32"),
            isConst: false,
            isArray: false,
          },
        ],
        returnType: TTypeUtils.createPrimitive("void"),
        visibility: "public",
        body: null,
      };

      const result = HeaderSymbolAdapter.fromTSymbol(tSymbol);

      expect(result.name).toBe("Motor_setSpeed");
      expect(result.type).toBe("void");
      expect(result.parameters).toHaveLength(1);
      expect(result.parameters?.[0].name).toBe("value");
      expect(result.parameters?.[0].type).toBe("f32");
      expect(result.signature).toBe("void Motor_setSpeed(f32)");
      expect(result.parent).toBe("Motor");
    });

    it("should convert function with array parameter", () => {
      const tSymbol: IFunctionSymbol = {
        kind: "function",
        name: "process",
        scope: globalScope,
        sourceFile: "process.cnx",
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
        parameters: [
          {
            name: "data",
            type: TTypeUtils.createPrimitive("u8"),
            isConst: true,
            isArray: true,
            arrayDimensions: [256],
          },
        ],
        returnType: TTypeUtils.createPrimitive("i32"),
        visibility: "public",
        body: null,
      };

      const result = HeaderSymbolAdapter.fromTSymbol(tSymbol);

      expect(result.parameters?.[0].isArray).toBe(true);
      expect(result.parameters?.[0].isConst).toBe(true);
      expect(result.parameters?.[0].arrayDimensions).toEqual(["256"]);
    });
  });

  describe("fromTSymbol - struct", () => {
    it("should convert global struct TSymbol", () => {
      const tSymbol: IStructSymbol = {
        kind: "struct",
        name: "Point",
        scope: globalScope,
        sourceFile: "geometry.cnx",
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
        fields: new Map([
          [
            "x",
            {
              name: "x",
              type: TTypeUtils.createPrimitive("i32"),
              isConst: false,
              isAtomic: false,
              isArray: false,
            },
          ],
        ]),
      };

      const result = HeaderSymbolAdapter.fromTSymbol(tSymbol);

      expect(result.name).toBe("Point");
      expect(result.kind).toBe("struct");
      expect(result.isExported).toBe(true);
      expect(result.parent).toBeUndefined();
    });

    it("should convert scoped struct with mangled name", () => {
      const geometryScope = ScopeUtils.createScope("Geometry", globalScope);
      const tSymbol: IStructSymbol = {
        kind: "struct",
        name: "Vector",
        scope: geometryScope,
        sourceFile: "geometry.cnx",
        sourceLine: 10,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
        fields: new Map(),
      };

      const result = HeaderSymbolAdapter.fromTSymbol(tSymbol);

      expect(result.name).toBe("Geometry_Vector");
      expect(result.parent).toBe("Geometry");
    });
  });

  describe("fromTSymbol - enum", () => {
    it("should convert global enum TSymbol", () => {
      const tSymbol: IEnumSymbol = {
        kind: "enum",
        name: "EColor",
        scope: globalScope,
        sourceFile: "colors.cnx",
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
        members: new Map([
          ["RED", 0],
          ["GREEN", 1],
          ["BLUE", 2],
        ]),
      };

      const result = HeaderSymbolAdapter.fromTSymbol(tSymbol);

      expect(result.name).toBe("EColor");
      expect(result.kind).toBe("enum");
      expect(result.isExported).toBe(true);
    });

    it("should convert scoped enum with mangled name", () => {
      const tSymbol: IEnumSymbol = {
        kind: "enum",
        name: "EMode",
        scope: motorScope,
        sourceFile: "motor.cnx",
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
        members: new Map([
          ["OFF", 0],
          ["ON", 1],
        ]),
      };

      const result = HeaderSymbolAdapter.fromTSymbol(tSymbol);

      expect(result.name).toBe("Motor_EMode");
      expect(result.parent).toBe("Motor");
    });
  });

  describe("fromTSymbol - bitmap", () => {
    it("should convert bitmap TSymbol", () => {
      const tSymbol: IBitmapSymbol = {
        kind: "bitmap",
        name: "Flags",
        scope: globalScope,
        sourceFile: "flags.cnx",
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
        backingType: "u8",
        bitWidth: 8,
        fields: new Map([
          ["enabled", { offset: 0, width: 1 }],
          ["ready", { offset: 1, width: 1 }],
        ]),
      };

      const result = HeaderSymbolAdapter.fromTSymbol(tSymbol);

      expect(result.name).toBe("Flags");
      expect(result.kind).toBe("bitmap");
      expect(result.type).toBe("u8");
      expect(result.isExported).toBe(true);
    });

    it("should convert scoped bitmap with mangled name", () => {
      const tSymbol: IBitmapSymbol = {
        kind: "bitmap",
        name: "Status",
        scope: motorScope,
        sourceFile: "motor.cnx",
        sourceLine: 5,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
        backingType: "u16",
        bitWidth: 16,
        fields: new Map(),
      };

      const result = HeaderSymbolAdapter.fromTSymbol(tSymbol);

      expect(result.name).toBe("Motor_Status");
      expect(result.type).toBe("u16");
      expect(result.parent).toBe("Motor");
    });
  });

  describe("fromTSymbol - register", () => {
    it("should convert register TSymbol", () => {
      const tSymbol: IRegisterSymbol = {
        kind: "register",
        name: "GPIO",
        scope: globalScope,
        sourceFile: "gpio.cnx",
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
        baseAddress: "0x40000000",
        members: new Map([
          ["DATA", { cType: "u32", offset: "0x00", access: "rw" as const }],
          ["DIR", { cType: "u32", offset: "0x04", access: "rw" as const }],
        ]),
      };

      const result = HeaderSymbolAdapter.fromTSymbol(tSymbol);

      expect(result.name).toBe("GPIO");
      expect(result.kind).toBe("register");
      expect(result.isExported).toBe(true);
    });

    it("should convert scoped register with mangled name", () => {
      const tSymbol: IRegisterSymbol = {
        kind: "register",
        name: "CTRL",
        scope: motorScope,
        sourceFile: "motor.cnx",
        sourceLine: 20,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
        baseAddress: "0x50000000",
        members: new Map(),
      };

      const result = HeaderSymbolAdapter.fromTSymbol(tSymbol);

      expect(result.name).toBe("Motor_CTRL");
      expect(result.parent).toBe("Motor");
    });
  });

  describe("fromTSymbol - scope", () => {
    it("should convert scope TSymbol", () => {
      const tSymbol: IScopeSymbol = {
        kind: "scope",
        name: "Motor",
        scope: globalScope,
        parent: globalScope,
        sourceFile: "motor.cnx",
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
        members: ["init", "setSpeed"],
        functions: [],
        variables: [],
        memberVisibility: new Map(),
      };

      const result = HeaderSymbolAdapter.fromTSymbol(tSymbol);

      expect(result.name).toBe("Motor");
      expect(result.kind).toBe("scope");
      expect(result.isExported).toBe(true);
    });
  });

  describe("fromTSymbols", () => {
    it("should convert array of TSymbols", () => {
      const tSymbols = [
        {
          kind: "variable" as const,
          name: "var1",
          scope: globalScope,
          sourceFile: "test.cnx",
          sourceLine: 1,
          sourceLanguage: ESourceLanguage.CNext,
          isExported: true,
          type: TTypeUtils.createPrimitive("u32"),
          isConst: false,
          isAtomic: false,
          isArray: false,
        },
        {
          kind: "function" as const,
          name: "func1",
          scope: globalScope,
          sourceFile: "test.cnx",
          sourceLine: 5,
          sourceLanguage: ESourceLanguage.CNext,
          isExported: true,
          parameters: [],
          returnType: TTypeUtils.createPrimitive("void"),
          visibility: "public" as const,
          body: null,
        },
      ];

      const results = HeaderSymbolAdapter.fromTSymbols(tSymbols);

      expect(results).toHaveLength(2);
      expect(results[0].name).toBe("var1");
      expect(results[0].kind).toBe("variable");
      expect(results[1].name).toBe("func1");
      expect(results[1].kind).toBe("function");
    });
  });

  // ========================================================================
  // Edge Cases
  // ========================================================================

  describe("edge cases", () => {
    it("should handle string dimensions in arrays", () => {
      const tSymbol: IVariableSymbol = {
        kind: "variable",
        name: "macroArray",
        scope: globalScope,
        sourceFile: "test.cnx",
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
        type: TTypeUtils.createPrimitive("u8"),
        isConst: false,
        isAtomic: false,
        isArray: true,
        arrayDimensions: ["DEVICE_COUNT"],
      };

      const result = HeaderSymbolAdapter.fromTSymbol(tSymbol);

      expect(result.arrayDimensions).toEqual(["DEVICE_COUNT"]);
    });

    it("should resolve qualified enum array dimensions", () => {
      const tSymbol: IVariableSymbol = {
        kind: "variable",
        name: "DATA",
        scope: globalScope,
        sourceFile: "test.cnx",
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
        type: TTypeUtils.createPrimitive("u8"),
        isConst: true,
        isAtomic: false,
        isArray: true,
        arrayDimensions: ["EColor.COUNT"],
      };

      const result = HeaderSymbolAdapter.fromTSymbol(tSymbol);

      // Qualified enum access should be converted to C-style underscore notation
      expect(result.arrayDimensions).toEqual(["EColor_COUNT"]);
    });

    it("should handle autoConst parameter flag", () => {
      const tSymbol: IFunctionSymbol = {
        kind: "function",
        name: "processData",
        scope: globalScope,
        sourceFile: "test.cnx",
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
        parameters: [
          {
            name: "data",
            type: TTypeUtils.createPrimitive("u8"),
            isConst: false,
            isArray: true,
            isAutoConst: true,
          },
        ],
        returnType: TTypeUtils.createPrimitive("void"),
        visibility: "public",
        body: null,
      };

      const result = HeaderSymbolAdapter.fromTSymbol(tSymbol);

      expect(result.parameters?.[0].isAutoConst).toBe(true);
    });
  });
});
