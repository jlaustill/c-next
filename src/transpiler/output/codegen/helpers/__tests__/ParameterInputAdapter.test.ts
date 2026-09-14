/**
 * Unit tests for ParameterInputAdapter
 *
 * Tests the adapter that normalizes AST and symbol data into IParameterInput.
 */

import { describe, it, expect } from "vitest";
import ParameterInputAdapter from "../ParameterInputAdapter";
import IParameterSymbol from "../../../../../utils/types/IParameterSymbol";
import CNextSourceParser from "../../../../logic/parser/CNextSourceParser.js";
import * as Parser from "../../../../logic/parser/grammar/CNextParser.js";
import ICallbackTypeInfo from "../../../../types/ICallbackTypeInfo";

/**
 * Extract the first parameter context from a function declaration.
 */
function getParameterContext(source: string): Parser.ParameterContext {
  const result = CNextSourceParser.parse(source);
  const decl = result.tree.declaration(0);
  const funcDecl = decl?.functionDeclaration();
  const paramList = funcDecl?.parameterList();
  const params = paramList?.parameter();
  if (!params || params.length === 0) {
    throw new Error("No parameters found in parsed source");
  }
  return params[0];
}

/**
 * Build default IFromASTDeps for testing.
 */
function createDefaultASTDeps(overrides?: {
  isModified?: boolean;
  isPassByValue?: boolean;
  isKnownStruct?: boolean;
  callbackTypes?: ReadonlyMap<string, ICallbackTypeInfo>;
}) {
  const typeMap: Record<string, string> = {
    u8: "uint8_t",
    u16: "uint16_t",
    u32: "uint32_t",
    u64: "uint64_t",
    i32: "int32_t",
    f32: "float",
    f64: "double",
    bool: "bool",
  };

  return {
    getTypeName: (type: Parser.TypeContext) => type.getText(),
    generateType: (type: Parser.TypeContext) => {
      const text = type.getText();
      // Strip array dimensions for mapped type
      const baseName = text.replace(/\[.*$/, "");
      return typeMap[baseName] ?? baseName;
    },
    generateExpression: (expr: Parser.ExpressionContext) => expr.getText(),
    callbackTypes:
      overrides?.callbackTypes ?? new Map<string, ICallbackTypeInfo>(),
    isKnownStruct: () => overrides?.isKnownStruct ?? false,
    typeMap,
    isModified: overrides?.isModified ?? false,
    isPassByValue: overrides?.isPassByValue ?? false,
    isCallbackCompatible: false,
    isTypedefStructType: () => false,
  };
}

describe("ParameterInputAdapter", () => {
  describe("fromSymbol", () => {
    const defaultDeps = {
      mapType: (t: string) => {
        const map: Record<string, string> = {
          u8: "uint8_t",
          u16: "uint16_t",
          u32: "uint32_t",
          u64: "uint64_t",
          i32: "int32_t",
          f32: "float",
          f64: "double",
          bool: "bool",
          ISR: "ISR",
        };
        return map[t] ?? t;
      },
      isPassByValue: false,
    };

    it("converts basic primitive parameter", () => {
      const param: IParameterSymbol = {
        name: "value",
        type: "u32",
        isConst: false,
        isArray: false,
      };

      const result = ParameterInputAdapter.fromSymbol(param, defaultDeps);

      expect(result.name).toBe("value");
      expect(result.baseType).toBe("u32");
      expect(result.mappedType).toBe("uint32_t");
      expect(result.isConst).toBe(false);
      expect(result.isArray).toBe(false);
      expect(result.isString).toBe(false);
      expect(result.isPassByValue).toBe(false);
    });

    it("converts array parameter", () => {
      const param: IParameterSymbol = {
        name: "arr",
        type: "u32",
        isConst: false,
        isArray: true,
        arrayDimensions: ["10"],
      };

      const result = ParameterInputAdapter.fromSymbol(param, defaultDeps);

      expect(result.isArray).toBe(true);
      expect(result.arrayDimensions).toEqual(["10"]);
      expect(result.isString).toBe(false);
    });

    it("converts multi-dimensional array parameter", () => {
      const param: IParameterSymbol = {
        name: "matrix",
        type: "u8",
        isConst: false,
        isArray: true,
        arrayDimensions: ["4", "4"],
      };

      const result = ParameterInputAdapter.fromSymbol(param, defaultDeps);

      expect(result.isArray).toBe(true);
      expect(result.arrayDimensions).toEqual(["4", "4"]);
    });

    it("converts unbounded string array with isUnboundedString flag", () => {
      const param: IParameterSymbol = {
        name: "strings",
        type: "string",
        isConst: false,
        isArray: true,
        arrayDimensions: ["5"],
      };

      const result = ParameterInputAdapter.fromSymbol(param, defaultDeps);

      expect(result.isArray).toBe(true);
      expect(result.isString).toBe(true);
      expect(result.isUnboundedString).toBe(true);
      expect(result.arrayDimensions).toEqual(["5"]);
      expect(result.mappedType).toBe("char");
    });

    it("converts bounded string array without isUnboundedString flag", () => {
      const param: IParameterSymbol = {
        name: "names",
        type: "string<32>",
        isConst: false,
        isArray: true,
        arrayDimensions: ["5", "33"],
      };

      const result = ParameterInputAdapter.fromSymbol(param, defaultDeps);

      expect(result.isArray).toBe(true);
      expect(result.isString).toBe(true);
      expect(result.isUnboundedString).toBe(false);
      expect(result.arrayDimensions).toEqual(["5", "33"]);
      expect(result.mappedType).toBe("char");
    });

    it("converts non-array string parameter", () => {
      const param: IParameterSymbol = {
        name: "name",
        type: "string<32>",
        isConst: false,
        isArray: false,
      };

      const result = ParameterInputAdapter.fromSymbol(param, defaultDeps);

      expect(result.isArray).toBe(false);
      expect(result.isString).toBe(true);
      expect(result.mappedType).toBe("char");
    });

    it.each([
      ["uses pass-by-value from deps for ISR", "handler", "ISR"],
      ["uses pass-by-value from deps for float types", "value", "f32"],
      ["uses pass-by-value from deps for enums", "status", "Status"],
    ])("%s", (_label, source, source2) => {
      const param: IParameterSymbol = {
        name: source,
        type: source2,
        isConst: false,
        isArray: false,
      };

      const deps = { ...defaultDeps, isPassByValue: true };
      const result = ParameterInputAdapter.fromSymbol(param, deps);

      expect(result.isPassByValue).toBe(true);
      expect(result.isPassByReference).toBe(false);
    });

    it("sets isPassByReference when not pass-by-value", () => {
      const param: IParameterSymbol = {
        name: "count",
        type: "u32",
        isConst: false,
        isArray: false,
      };

      const result = ParameterInputAdapter.fromSymbol(param, defaultDeps);

      expect(result.isPassByValue).toBe(false);
      expect(result.isPassByReference).toBe(true);
    });

    it("preserves const modifier", () => {
      const param: IParameterSymbol = {
        name: "value",
        type: "u32",
        isConst: true,
        isArray: false,
      };

      const result = ParameterInputAdapter.fromSymbol(param, defaultDeps);

      expect(result.isConst).toBe(true);
    });

    it("preserves auto-const", () => {
      const param: IParameterSymbol = {
        name: "point",
        type: "Point",
        isConst: false,
        isArray: false,
        isAutoConst: true,
      };

      const result = ParameterInputAdapter.fromSymbol(param, defaultDeps);

      expect(result.isAutoConst).toBe(true);
    });

    it("defaults auto-const to false when not specified", () => {
      const param: IParameterSymbol = {
        name: "point",
        type: "Point",
        isConst: false,
        isArray: false,
        // isAutoConst not specified
      };

      const result = ParameterInputAdapter.fromSymbol(param, defaultDeps);

      expect(result.isAutoConst).toBe(false);
    });

    it("forces pointer when isCallbackPointer is set (Issue #914)", () => {
      const param: IParameterSymbol = {
        name: "buf",
        type: "u8",
        isConst: false,
        isArray: false,
        isCallbackPointer: true,
      };

      // Even though deps says pass-by-value, callback overrides it
      const deps = { ...defaultDeps, isPassByValue: true };
      const result = ParameterInputAdapter.fromSymbol(param, deps);

      expect(result.isPassByValue).toBe(false);
      expect(result.isPassByReference).toBe(true);
      expect(result.forcePointerSyntax).toBe(true);
    });

    it("forces const when isCallbackConst is set (Issue #914)", () => {
      const param: IParameterSymbol = {
        name: "area",
        type: "rect_t",
        isConst: false,
        isArray: false,
        isCallbackPointer: true,
        isCallbackConst: true,
      };

      const result = ParameterInputAdapter.fromSymbol(param, defaultDeps);

      expect(result.forceConst).toBe(true);
      expect(result.forcePointerSyntax).toBe(true);
    });

    it("does not force pointer when isCallbackPointer is not set", () => {
      const param: IParameterSymbol = {
        name: "value",
        type: "u32",
        isConst: false,
        isArray: false,
      };

      const result = ParameterInputAdapter.fromSymbol(param, defaultDeps);

      expect(result.forcePointerSyntax).toBeUndefined();
      expect(result.forceConst).toBeUndefined();
    });

    // Issue #995: Opaque handle support in fromSymbol
    it("passes through isOpaqueHandle when set (Issue #995)", () => {
      // The adapter passes through isOpaqueHandle; ParameterSignatureBuilder
      // applies the rule (suppress auto-const, force pointer syntax)
      const param: IParameterSymbol = {
        name: "widget",
        type: "widget_t",
        isConst: false,
        isArray: false,
        isOpaqueHandle: true,
      };

      const result = ParameterInputAdapter.fromSymbol(param, defaultDeps);

      expect(result.isOpaqueHandle).toBe(true);
    });

    it("passes through isAutoConst even when isOpaqueHandle is set (builder applies rule)", () => {
      // The adapter passes through both flags; the builder suppresses auto-const
      // for opaque handles — this is NOT the adapter's responsibility
      const param: IParameterSymbol = {
        name: "widget",
        type: "widget_t",
        isConst: false,
        isArray: false,
        isOpaqueHandle: true,
        isAutoConst: true,
      };

      const result = ParameterInputAdapter.fromSymbol(param, defaultDeps);

      // Adapter passes through isAutoConst as-is; builder will suppress it
      expect(result.isAutoConst).toBe(true);
      expect(result.isOpaqueHandle).toBe(true);
    });

    it("does not force pointer when isOpaqueHandle is not set", () => {
      const param: IParameterSymbol = {
        name: "point",
        type: "Point",
        isConst: false,
        isArray: false,
      };

      const result = ParameterInputAdapter.fromSymbol(param, defaultDeps);

      expect(result.forcePointerSyntax).toBeUndefined();
    });
  });

  describe("fromAST", () => {
    it("converts basic primitive parameter", () => {
      const ctx = getParameterContext("void foo(u32 value) {}");
      const deps = createDefaultASTDeps();

      const result = ParameterInputAdapter.fromAST(ctx, deps);

      expect(result.name).toBe("value");
      expect(result.baseType).toBe("u32");
      expect(result.mappedType).toBe("uint32_t");
      expect(result.isConst).toBe(false);
      expect(result.isArray).toBe(false);
      expect(result.isString).toBe(false);
      expect(result.isCallback).toBe(false);
      expect(result.isPassByValue).toBe(false);
      expect(result.isPassByReference).toBe(true);
    });

    it("converts const parameter", () => {
      const ctx = getParameterContext("void foo(const u32 value) {}");
      const deps = createDefaultASTDeps();

      const result = ParameterInputAdapter.fromAST(ctx, deps);

      expect(result.isConst).toBe(true);
      expect(result.isAutoConst).toBe(false);
    });

    /**
     * Auto-const is ONE derivation over three inputs -- the parameter's type,
     * whether the body modifies it, and what `isOpaqueType` says -- so it is
     * one table. Written out as four separate `it`s, three of them read as an
     * S5976 cluster; the table is also the clearer form, because the two
     * Issue #995 rows exist precisely to pin the two ways `isOpaqueType` can
     * be absent AGAINST the ordinary case, which is a comparison a reader can
     * only make when the rows sit together.
     */
    it.each<
      [
        string,
        string,
        boolean,
        { isOpaqueType?: (typeName: string) => boolean },
        boolean,
      ]
    >([
      [
        "unmodified non-const parameter",
        "void foo(u32 value) {}",
        false,
        {},
        true,
      ],
      ["modified parameter", "void foo(u32 value) {}", true, {}, false],
      // Issue #995: a non-opaque type still gets auto-const ...
      [
        "non-opaque type, isOpaqueType returns false",
        "void foo(Point p) {}",
        false,
        { isOpaqueType: () => false },
        true,
      ],
      // ... and so does one whose deps supply no `isOpaqueType` at all.
      [
        "user type, isOpaqueType not provided",
        "void foo(Point p) {}",
        false,
        {},
        true,
      ],
    ])(
      "derives isAutoConst for %s",
      (_label, source, isModified, depsOverride, expected) => {
        const ctx = getParameterContext(source);
        const deps = {
          ...createDefaultASTDeps({ isModified }),
          ...depsOverride,
        };

        const result = ParameterInputAdapter.fromAST(ctx, deps);

        expect(result.isAutoConst).toBe(expected);
      },
    );

    it("converts array parameter with dimension", () => {
      const ctx = getParameterContext("void foo(u32[10] arr) {}");
      const deps = createDefaultASTDeps();

      const result = ParameterInputAdapter.fromAST(ctx, deps);

      expect(result.isArray).toBe(true);
      expect(result.arrayDimensions).toEqual(["10"]);
      expect(result.isPassByValue).toBe(false);
      expect(result.isPassByReference).toBe(false);
    });

    it("converts multi-dimensional array parameter", () => {
      const ctx = getParameterContext("void foo(u8[4][4] matrix) {}");
      const deps = createDefaultASTDeps();

      const result = ParameterInputAdapter.fromAST(ctx, deps);

      expect(result.isArray).toBe(true);
      expect(result.arrayDimensions).toEqual(["4", "4"]);
    });

    // Issue #986: ADR-006 says arrays are mutable by default.
    // Arrays should never get auto-const, even when unmodified.
    it("does not set auto-const for unmodified array parameter", () => {
      const ctx = getParameterContext("void foo(u8[8] data) {}");
      const deps = createDefaultASTDeps({ isModified: false });

      const result = ParameterInputAdapter.fromAST(ctx, deps);

      expect(result.isArray).toBe(true);
      expect(result.isAutoConst).toBe(false); // Arrays never get auto-const
    });

    it("converts non-array string parameter", () => {
      const ctx = getParameterContext("void foo(string<32> name) {}");
      const deps = createDefaultASTDeps();

      const result = ParameterInputAdapter.fromAST(ctx, deps);

      expect(result.isString).toBe(true);
      expect(result.isArray).toBe(false);
      expect(result.mappedType).toBe("char");
      expect(result.stringCapacity).toBe(32);
      expect(result.isPassByValue).toBe(false);
      expect(result.isPassByReference).toBe(false);
    });

    it("converts callback parameter", () => {
      const callbackTypes = new Map<string, ICallbackTypeInfo>([
        [
          "handleClick",
          {
            functionName: "handleClick",
            returnType: "void",
            parameters: [],
            typedefName: "handleClick_fp",
          },
        ],
      ]);
      const ctx = getParameterContext("void foo(handleClick onClick) {}");
      const deps = createDefaultASTDeps({ callbackTypes });

      const result = ParameterInputAdapter.fromAST(ctx, deps);

      expect(result.isCallback).toBe(true);
      expect(result.callbackTypedefName).toBe("handleClick_fp");
      expect(result.isPassByValue).toBe(true);
      expect(result.isPassByReference).toBe(false);
    });

    it("sets isPassByReference for known struct", () => {
      const ctx = getParameterContext("void foo(Point p) {}");
      const deps = createDefaultASTDeps({ isKnownStruct: true });

      const result = ParameterInputAdapter.fromAST(ctx, deps);

      expect(result.isPassByReference).toBe(true);
      expect(result.isPassByValue).toBe(false);
    });

    it("sets isPassByValue when pre-computed", () => {
      const ctx = getParameterContext("void foo(f32 value) {}");
      const deps = createDefaultASTDeps({ isPassByValue: true });

      const result = ParameterInputAdapter.fromAST(ctx, deps);

      expect(result.isPassByValue).toBe(true);
    });

    it("converts string array with capacity (string<N>[M])", () => {
      const ctx = getParameterContext("void foo(string<32>[5] names) {}");
      const deps = createDefaultASTDeps();

      const result = ParameterInputAdapter.fromAST(ctx, deps);

      expect(result.isArray).toBe(true);
      expect(result.isString).toBe(true);
      // Capacity + 1 for null terminator appended as extra dimension
      expect(result.arrayDimensions).toEqual(["5", "33"]);
      expect(result.isPassByReference).toBe(false);
    });

    it("passes through forceConst from deps (Issue #895)", () => {
      const ctx = getParameterContext("void foo(Point area) {}");
      const deps = {
        ...createDefaultASTDeps({ isKnownStruct: true }),
        forceConst: true,
      };

      const result = ParameterInputAdapter.fromAST(ctx, deps);

      expect(result.forceConst).toBe(true);
    });

    it("passes through forcePassByReference and forceConst together", () => {
      const ctx = getParameterContext("void foo(Point area) {}");
      const deps = {
        ...createDefaultASTDeps({ isKnownStruct: true }),
        forcePassByReference: true,
        forceConst: true,
      };

      const result = ParameterInputAdapter.fromAST(ctx, deps);

      expect(result.forcePointerSyntax).toBe(true);
      expect(result.forceConst).toBe(true);
      expect(result.isPassByReference).toBe(true);
    });

    it("forceConst defaults to undefined when not provided", () => {
      const ctx = getParameterContext("void foo(Point area) {}");
      const deps = createDefaultASTDeps({ isKnownStruct: true });

      const result = ParameterInputAdapter.fromAST(ctx, deps);

      expect(result.forceConst).toBeUndefined();
    });

    // Issue #995: Opaque handles pass through isOpaqueHandle; builder applies rule
    it("passes through isOpaqueHandle for opaque type parameter", () => {
      const ctx = getParameterContext("void foo(widget_t w) {}");
      const deps = {
        ...createDefaultASTDeps({ isModified: false }),
        isOpaqueType: (typeName: string) => typeName === "widget_t",
      };

      const result = ParameterInputAdapter.fromAST(ctx, deps);

      // Adapter passes through detection; builder applies rule
      expect(result.isOpaqueHandle).toBe(true);
      // isAutoConst computed normally; builder will suppress it for opaque handles
      expect(result.isAutoConst).toBe(true);
    });

    // Issue #995: Opaque handles don't set forcePointerSyntax — builder handles it
    it("does not set forcePointerSyntax for opaque type (builder handles it)", () => {
      const ctx = getParameterContext("void foo(widget_t w) {}");
      const deps = {
        ...createDefaultASTDeps({ isModified: false }),
        isOpaqueType: (typeName: string) => typeName === "widget_t",
        isTypedefStructType: () => false, // Not a typedef struct
      };

      const result = ParameterInputAdapter.fromAST(ctx, deps);

      // forcePointerSyntax not set by adapter for opaque handles
      // (builder uses isOpaqueHandle instead)
      expect(result.forcePointerSyntax).toBeUndefined();
      expect(result.isOpaqueHandle).toBe(true);
    });
  });
});
