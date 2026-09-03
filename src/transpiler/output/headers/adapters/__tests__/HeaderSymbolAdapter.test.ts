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
import TestSymbolUtils from "../../../../logic/symbols/cnext/__tests__/testSymbolUtils";
import TestSourceSpan from "../../../../types/__testUtils__/testSourceSpan";

describe("HeaderSymbolAdapter", () => {
  // ========================================================================
  // fromTSymbol - TSymbol to IHeaderSymbol Conversion
  // ========================================================================

  describe("fromTSymbol - variable", () => {
    it("should convert global variable TSymbol", () => {
      const tSymbol: IVariableSymbol = {
        ...TestSymbolUtils.base({
          kind: "variable",
          name: "counter",
          scopePath: "",
          sourceFile: "test.cnx",
          span: TestSourceSpan.at(1),
          sourceLanguage: ESourceLanguage.CNext,
          visibility: "public",
        }),
        type: TTypeUtils.createPrimitive("u32"),
        isConst: false,
        isAtomic: false,
        isVolatile: false,
        overflowBehavior: "clamp",
        isArray: false,
      };

      const result = HeaderSymbolAdapter.fromTSymbol(tSymbol);

      expect(result.name).toBe("counter");
      expect(result.kind).toBe("variable");
      expect(result.type).toBe("u32");
      expect(result.parent).toBeUndefined();
    });

    it("should convert scoped variable with transpiled C name", () => {
      const tSymbol: IVariableSymbol = {
        ...TestSymbolUtils.base({
          kind: "variable",
          name: "speed",
          scopePath: "Motor",
          sourceFile: "motor.cnx",
          span: TestSourceSpan.at(5),
          sourceLanguage: ESourceLanguage.CNext,
          visibility: "public",
        }),
        type: TTypeUtils.createPrimitive("f32"),
        isConst: false,
        isAtomic: true,
        isVolatile: false,
        overflowBehavior: "clamp",
        isArray: false,
      };

      const result = HeaderSymbolAdapter.fromTSymbol(tSymbol);

      expect(result.name).toBe("Motor__speed");
      expect(result.type).toBe("f32");
      expect(result.isAtomic).toBe(true);
      expect(result.parent).toBe("Motor");
    });

    it("should convert array variable with dimensions", () => {
      const tSymbol: IVariableSymbol = {
        ...TestSymbolUtils.base({
          kind: "variable",
          name: "buffer",
          scopePath: "",
          sourceFile: "data.cnx",
          span: TestSourceSpan.at(1),
          sourceLanguage: ESourceLanguage.CNext,
          visibility: "public",
        }),
        type: TTypeUtils.createPrimitive("u8"),
        isConst: false,
        isAtomic: false,
        isVolatile: false,
        overflowBehavior: "clamp",
        isArray: true,
        arrayDimensions: [256, 4],
      };

      const result = HeaderSymbolAdapter.fromTSymbol(tSymbol);

      expect(result.isArray).toBe(true);
      expect(result.arrayDimensions).toEqual(["256", "4"]);
    });

    it("should convert const variable", () => {
      const tSymbol: IVariableSymbol = {
        ...TestSymbolUtils.base({
          kind: "variable",
          name: "MAX_SIZE",
          scopePath: "",
          sourceFile: "config.cnx",
          span: TestSourceSpan.at(1),
          sourceLanguage: ESourceLanguage.CNext,
          visibility: "public",
        }),
        type: TTypeUtils.createPrimitive("u32"),
        isConst: true,
        isAtomic: false,
        isVolatile: false,
        overflowBehavior: "clamp",
        isArray: false,
      };

      const result = HeaderSymbolAdapter.fromTSymbol(tSymbol);

      expect(result.isConst).toBe(true);
    });
  });

  describe("fromTSymbol - function", () => {
    it("should convert global function TSymbol", () => {
      const tSymbol: IFunctionSymbol = {
        ...TestSymbolUtils.base({
          kind: "function",
          name: "init",
          scopePath: "",
          sourceFile: "main.cnx",
          span: TestSourceSpan.at(1),
          sourceLanguage: ESourceLanguage.CNext,
          visibility: "public",
        }),
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
        ...TestSymbolUtils.base({
          kind: "function",
          name: "setSpeed",
          scopePath: "Motor",
          sourceFile: "motor.cnx",
          span: TestSourceSpan.at(10),
          sourceLanguage: ESourceLanguage.CNext,
          visibility: "public",
        }),
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

      expect(result.name).toBe("Motor__setSpeed");
      expect(result.type).toBe("void");
      expect(result.parameters).toHaveLength(1);
      expect(result.parameters?.[0].name).toBe("value");
      expect(result.parameters?.[0].type).toBe("f32");
      expect(result.signature).toBe("void Motor__setSpeed(f32)");
      expect(result.parent).toBe("Motor");
    });

    it("should convert function with array parameter", () => {
      const tSymbol: IFunctionSymbol = {
        ...TestSymbolUtils.base({
          kind: "function",
          name: "process",
          scopePath: "",
          sourceFile: "process.cnx",
          span: TestSourceSpan.at(1),
          sourceLanguage: ESourceLanguage.CNext,
          visibility: "public",
        }),
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
        ...TestSymbolUtils.base({
          kind: "struct",
          name: "Point",
          scopePath: "",
          sourceFile: "geometry.cnx",
          span: TestSourceSpan.at(1),
          sourceLanguage: ESourceLanguage.CNext,
          visibility: "public",
        }),
        fields: new Map([
          [
            "x",
            {
              name: "x",
              type: TTypeUtils.createPrimitive("i32"),
              isConst: false,
              isAtomic: false,
              isVolatile: false,
              overflowBehavior: "clamp",
              isArray: false,
            },
          ],
        ]),
      };

      const result = HeaderSymbolAdapter.fromTSymbol(tSymbol);

      expect(result.name).toBe("Point");
      expect(result.kind).toBe("struct");
      expect(result.parent).toBeUndefined();
    });

    it("should convert scoped struct with transpiled C name", () => {
      const tSymbol: IStructSymbol = {
        ...TestSymbolUtils.base({
          kind: "struct",
          name: "Vector",
          scopePath: "Geometry",
          sourceFile: "geometry.cnx",
          span: TestSourceSpan.at(10),
          sourceLanguage: ESourceLanguage.CNext,
          visibility: "public",
        }),
        fields: new Map(),
      };

      const result = HeaderSymbolAdapter.fromTSymbol(tSymbol);

      expect(result.name).toBe("Geometry__Vector");
      expect(result.parent).toBe("Geometry");
    });
  });

  describe("fromTSymbol - enum", () => {
    it("should convert global enum TSymbol", () => {
      const tSymbol: IEnumSymbol = {
        ...TestSymbolUtils.base({
          kind: "enum",
          name: "EColor",
          scopePath: "",
          sourceFile: "colors.cnx",
          span: TestSourceSpan.at(1),
          sourceLanguage: ESourceLanguage.CNext,
          visibility: "public",
        }),
        members: new Map([
          ["RED", 0],
          ["GREEN", 1],
          ["BLUE", 2],
        ]),
      };

      const result = HeaderSymbolAdapter.fromTSymbol(tSymbol);

      expect(result.name).toBe("EColor");
      expect(result.kind).toBe("enum");
    });

    it("should convert scoped enum with transpiled C name", () => {
      const tSymbol: IEnumSymbol = {
        ...TestSymbolUtils.base({
          kind: "enum",
          name: "EMode",
          scopePath: "Motor",
          sourceFile: "motor.cnx",
          span: TestSourceSpan.at(1),
          sourceLanguage: ESourceLanguage.CNext,
          visibility: "public",
        }),
        members: new Map([
          ["OFF", 0],
          ["ON", 1],
        ]),
      };

      const result = HeaderSymbolAdapter.fromTSymbol(tSymbol);

      expect(result.name).toBe("Motor__EMode");
      expect(result.parent).toBe("Motor");
    });
  });

  describe("fromTSymbol - bitmap", () => {
    it("should convert bitmap TSymbol", () => {
      const tSymbol: IBitmapSymbol = {
        ...TestSymbolUtils.base({
          kind: "bitmap",
          name: "Flags",
          scopePath: "",
          sourceFile: "flags.cnx",
          span: TestSourceSpan.at(1),
          sourceLanguage: ESourceLanguage.CNext,
          visibility: "public",
        }),
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
    });

    it("should convert scoped bitmap with transpiled C name", () => {
      const tSymbol: IBitmapSymbol = {
        ...TestSymbolUtils.base({
          kind: "bitmap",
          name: "Status",
          scopePath: "Motor",
          sourceFile: "motor.cnx",
          span: TestSourceSpan.at(5),
          sourceLanguage: ESourceLanguage.CNext,
          visibility: "public",
        }),
        backingType: "u16",
        bitWidth: 16,
        fields: new Map(),
      };

      const result = HeaderSymbolAdapter.fromTSymbol(tSymbol);

      expect(result.name).toBe("Motor__Status");
      expect(result.type).toBe("u16");
      expect(result.parent).toBe("Motor");
    });
  });

  describe("fromTSymbol - register", () => {
    it("should convert register TSymbol", () => {
      const tSymbol: IRegisterSymbol = {
        ...TestSymbolUtils.base({
          kind: "register",
          name: "GPIO",
          scopePath: "",
          sourceFile: "gpio.cnx",
          span: TestSourceSpan.at(1),
          sourceLanguage: ESourceLanguage.CNext,
          visibility: "public",
        }),
        baseAddress: "0x40000000",
        members: new Map([
          ["DATA", { cType: "u32", offset: "0x00", access: "rw" as const }],
          ["DIR", { cType: "u32", offset: "0x04", access: "rw" as const }],
        ]),
      };

      const result = HeaderSymbolAdapter.fromTSymbol(tSymbol);

      expect(result.name).toBe("GPIO");
      expect(result.kind).toBe("register");
    });

    it("should convert scoped register with transpiled C name", () => {
      const tSymbol: IRegisterSymbol = {
        ...TestSymbolUtils.base({
          kind: "register",
          name: "CTRL",
          scopePath: "Motor",
          sourceFile: "motor.cnx",
          span: TestSourceSpan.at(20),
          sourceLanguage: ESourceLanguage.CNext,
          visibility: "public",
        }),
        baseAddress: "0x50000000",
        members: new Map(),
      };

      const result = HeaderSymbolAdapter.fromTSymbol(tSymbol);

      expect(result.name).toBe("Motor__CTRL");
      expect(result.parent).toBe("Motor");
    });
  });

  describe("fromTSymbol - scope", () => {
    it("should convert scope TSymbol", () => {
      const tSymbol: IScopeSymbol = {
        ...TestSymbolUtils.base({
          kind: "scope",
          name: "Motor",
          scopePath: "",
          sourceFile: "motor.cnx",
          span: TestSourceSpan.at(1),
          sourceLanguage: ESourceLanguage.CNext,
          visibility: "public",
        }),
        members: ["init", "setSpeed"],
        functions: [],
        variables: [],
        memberVisibility: new Map(),
        declarationSites: new Set<string>(),
      };

      const result = HeaderSymbolAdapter.fromTSymbol(tSymbol);

      expect(result.name).toBe("Motor");
      expect(result.kind).toBe("scope");
      // #1298 DoD: a top-level scope has no container, so `parent` is absent --
      // as opposed to being omitted whatever the scope's position, which is what
      // this converter used to do for every scope alike.
      expect(result.parent).toBeUndefined();
    });

    it("states the container of a NESTED scope", () => {
      // The half the previous case cannot distinguish: before #1298 this
      // converter omitted `parent` unconditionally, so a nested scope and a
      // top-level one produced the same header symbol.
      const tSymbol: IScopeSymbol = {
        ...TestSymbolUtils.base({
          kind: "scope",
          name: "Inner",
          scopePath: "Outer",
          sourceFile: "motor.cnx",
          span: TestSourceSpan.at(1),
          sourceLanguage: ESourceLanguage.CNext,
          visibility: "public",
        }),
        members: [],
        functions: [],
        variables: [],
        memberVisibility: new Map(),
        declarationSites: new Set<string>(),
      };

      const result = HeaderSymbolAdapter.fromTSymbol(tSymbol);

      expect(result.name).toBe("Inner");
      expect(result.parent).toBe("Outer");
    });
  });

  describe("fromTSymbols", () => {
    it("should convert array of TSymbols", () => {
      const tSymbols = [
        {
          ...TestSymbolUtils.base({
            kind: "variable" as const,
            name: "var1",
            scopePath: "",
            sourceFile: "test.cnx",
            span: TestSourceSpan.at(1),
          }),
          type: TTypeUtils.createPrimitive("u32"),
          isConst: false,
          isAtomic: false,
          isVolatile: false,
          overflowBehavior: "clamp" as const,
          isArray: false,
        },
        {
          ...TestSymbolUtils.base({
            kind: "function" as const,
            name: "func1",
            scopePath: "",
            sourceFile: "test.cnx",
            span: TestSourceSpan.at(5),
          }),
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
        ...TestSymbolUtils.base({
          kind: "variable",
          name: "macroArray",
          scopePath: "",
          sourceFile: "test.cnx",
          span: TestSourceSpan.at(1),
          sourceLanguage: ESourceLanguage.CNext,
          visibility: "public",
        }),
        type: TTypeUtils.createPrimitive("u8"),
        isConst: false,
        isAtomic: false,
        isVolatile: false,
        overflowBehavior: "clamp",
        isArray: true,
        arrayDimensions: ["DEVICE_COUNT"],
      };

      const result = HeaderSymbolAdapter.fromTSymbol(tSymbol);

      expect(result.arrayDimensions).toEqual(["DEVICE_COUNT"]);
    });

    it("should resolve qualified enum array dimensions", () => {
      const tSymbol: IVariableSymbol = {
        ...TestSymbolUtils.base({
          kind: "variable",
          name: "DATA",
          scopePath: "",
          sourceFile: "test.cnx",
          span: TestSourceSpan.at(1),
          sourceLanguage: ESourceLanguage.CNext,
          visibility: "public",
        }),
        type: TTypeUtils.createPrimitive("u8"),
        isConst: true,
        isAtomic: false,
        isVolatile: false,
        overflowBehavior: "clamp",
        isArray: true,
        arrayDimensions: ["EColor.COUNT"],
      };

      const result = HeaderSymbolAdapter.fromTSymbol(tSymbol);

      // Qualified enum access should be converted to C-style underscore notation
      expect(result.arrayDimensions).toEqual(["EColor__COUNT"]);
    });

    // The dimension arrives as C-Next SOURCE, so it must be resolved with the same
    // scope awareness the .c path uses — otherwise the header names a different
    // symbol than the implementation and does not compile (#1117 review).
    describe("scope-aware array dimensions", () => {
      const makeArrayVar = (
        scopePath: string,
        dim: string,
      ): IVariableSymbol => ({
        ...TestSymbolUtils.base({
          kind: "variable",
          name: "counters",
          scopePath,
          sourceFile: "test.cnx",
        }),
        span: TestSourceSpan.at(1),
        sourceLanguage: ESourceLanguage.CNext,
        visibility: "public",
        type: TTypeUtils.createPrimitive("u8"),
        isConst: false,
        isAtomic: false,
        isVolatile: false,
        overflowBehavior: "clamp",
        isArray: true,
        arrayDimensions: [dim],
      });

      it("strips global. and adds no scope prefix", () => {
        const result = HeaderSymbolAdapter.fromTSymbol(
          makeArrayVar("Motor", "global.EColor.COUNT"),
        );

        expect(result.arrayDimensions).toEqual(["EColor__COUNT"]);
      });

      it("strips this. and prefixes the declaring scope", () => {
        const result = HeaderSymbolAdapter.fromTSymbol(
          makeArrayVar("Motor", "this.State.COUNT"),
        );

        // `this` must not survive as a name component
        expect(result.arrayDimensions).toEqual(["Motor__State__COUNT"]);
      });

      it("leaves a bare dotted path unprefixed when the scope has no such enum", () => {
        // CodeGenState has no registered enums here, so the bare path resolves
        // global-first — matching the .c path for a top-level enum.
        const result = HeaderSymbolAdapter.fromTSymbol(
          makeArrayVar("Motor", "Global.COUNT"),
        );

        expect(result.arrayDimensions).toEqual(["Global__COUNT"]);
      });

      it("leaves a non-qualified dimension untouched", () => {
        const result = HeaderSymbolAdapter.fromTSymbol(
          makeArrayVar("Motor", "DEVICE_COUNT"),
        );

        expect(result.arrayDimensions).toEqual(["DEVICE_COUNT"]);
      });
    });

    it("should handle autoConst parameter flag", () => {
      const tSymbol: IFunctionSymbol = {
        ...TestSymbolUtils.base({
          kind: "function",
          name: "processData",
          scopePath: "",
          sourceFile: "test.cnx",
          span: TestSourceSpan.at(1),
          sourceLanguage: ESourceLanguage.CNext,
          visibility: "public",
        }),
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
