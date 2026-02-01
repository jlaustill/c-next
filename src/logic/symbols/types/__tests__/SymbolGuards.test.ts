import { describe, expect, it } from "vitest";
import ESourceLanguage from "../../../../utils/types/ESourceLanguage";
import ESymbolKind from "../../../../utils/types/ESymbolKind";
import IBitmapSymbol from "../IBitmapSymbol";
import IEnumSymbol from "../IEnumSymbol";
import IFunctionSymbol from "../IFunctionSymbol";
import IRegisterSymbol from "../IRegisterSymbol";
import IScopeSymbol from "../IScopeSymbol";
import IStructSymbol from "../IStructSymbol";
import IVariableSymbol from "../IVariableSymbol";
import TSymbol from "../TSymbol";
import SymbolGuards from "../typeGuards";

const baseFields = {
  name: "TestSymbol",
  sourceFile: "test.cnx",
  sourceLine: 1,
  sourceLanguage: ESourceLanguage.CNext,
  isExported: true,
};

describe("SymbolGuards", () => {
  const structSymbol: IStructSymbol = {
    ...baseFields,
    kind: ESymbolKind.Struct,
    fields: new Map([["x", { type: "u32", isArray: false, isConst: false }]]),
  };

  const enumSymbol: IEnumSymbol = {
    ...baseFields,
    kind: ESymbolKind.Enum,
    members: new Map([
      ["A", 0],
      ["B", 1],
    ]),
  };

  const bitmapSymbol: IBitmapSymbol = {
    ...baseFields,
    kind: ESymbolKind.Bitmap,
    backingType: "u8",
    bitWidth: 8,
    fields: new Map([["flag", { offset: 0, width: 1 }]]),
  };

  const functionSymbol: IFunctionSymbol = {
    ...baseFields,
    kind: ESymbolKind.Function,
    returnType: "void",
    parameters: [],
    visibility: "public",
  };

  const variableSymbol: IVariableSymbol = {
    ...baseFields,
    kind: ESymbolKind.Variable,
    type: "u32",
    isConst: false,
    isAtomic: false,
    isArray: false,
  };

  const scopeSymbol: IScopeSymbol = {
    ...baseFields,
    kind: ESymbolKind.Namespace,
    members: ["init", "update"],
    memberVisibility: new Map([
      ["init", "public"],
      ["update", "private"],
    ]),
  };

  const registerSymbol: IRegisterSymbol = {
    ...baseFields,
    kind: ESymbolKind.Register,
    baseAddress: "0x40000000",
    members: new Map([
      ["DATA", { offset: "0x00", cType: "uint32_t", access: "rw" }],
    ]),
  };

  const allSymbols: TSymbol[] = [
    structSymbol,
    enumSymbol,
    bitmapSymbol,
    functionSymbol,
    variableSymbol,
    scopeSymbol,
    registerSymbol,
  ];

  describe("isStruct", () => {
    it("returns true for struct symbols", () => {
      expect(SymbolGuards.isStruct(structSymbol)).toBe(true);
    });

    it("returns false for non-struct symbols", () => {
      for (const symbol of allSymbols) {
        if (symbol.kind !== ESymbolKind.Struct) {
          expect(SymbolGuards.isStruct(symbol)).toBe(false);
        }
      }
    });

    it("narrows type correctly", () => {
      const symbol: TSymbol = structSymbol;
      if (SymbolGuards.isStruct(symbol)) {
        // TypeScript should know this is IStructSymbol
        expect(symbol.fields.get("x")?.type).toBe("u32");
      }
    });
  });

  describe("isEnum", () => {
    it("returns true for enum symbols", () => {
      expect(SymbolGuards.isEnum(enumSymbol)).toBe(true);
    });

    it("returns false for non-enum symbols", () => {
      for (const symbol of allSymbols) {
        if (symbol.kind !== ESymbolKind.Enum) {
          expect(SymbolGuards.isEnum(symbol)).toBe(false);
        }
      }
    });

    it("narrows type correctly", () => {
      const symbol: TSymbol = enumSymbol;
      if (SymbolGuards.isEnum(symbol)) {
        expect(symbol.members.get("A")).toBe(0);
      }
    });
  });

  describe("isBitmap", () => {
    it("returns true for bitmap symbols", () => {
      expect(SymbolGuards.isBitmap(bitmapSymbol)).toBe(true);
    });

    it("returns false for non-bitmap symbols", () => {
      for (const symbol of allSymbols) {
        if (symbol.kind !== ESymbolKind.Bitmap) {
          expect(SymbolGuards.isBitmap(symbol)).toBe(false);
        }
      }
    });

    it("narrows type correctly", () => {
      const symbol: TSymbol = bitmapSymbol;
      if (SymbolGuards.isBitmap(symbol)) {
        expect(symbol.backingType).toBe("u8");
        expect(symbol.fields.get("flag")?.width).toBe(1);
      }
    });
  });

  describe("isFunction", () => {
    it("returns true for function symbols", () => {
      expect(SymbolGuards.isFunction(functionSymbol)).toBe(true);
    });

    it("returns false for non-function symbols", () => {
      for (const symbol of allSymbols) {
        if (symbol.kind !== ESymbolKind.Function) {
          expect(SymbolGuards.isFunction(symbol)).toBe(false);
        }
      }
    });

    it("narrows type correctly", () => {
      const symbol: TSymbol = functionSymbol;
      if (SymbolGuards.isFunction(symbol)) {
        expect(symbol.returnType).toBe("void");
        expect(symbol.visibility).toBe("public");
      }
    });
  });

  describe("isVariable", () => {
    it("returns true for variable symbols", () => {
      expect(SymbolGuards.isVariable(variableSymbol)).toBe(true);
    });

    it("returns false for non-variable symbols", () => {
      for (const symbol of allSymbols) {
        if (symbol.kind !== ESymbolKind.Variable) {
          expect(SymbolGuards.isVariable(symbol)).toBe(false);
        }
      }
    });

    it("narrows type correctly", () => {
      const symbol: TSymbol = variableSymbol;
      if (SymbolGuards.isVariable(symbol)) {
        expect(symbol.type).toBe("u32");
        expect(symbol.isConst).toBe(false);
      }
    });
  });

  describe("isScope", () => {
    it("returns true for scope symbols", () => {
      expect(SymbolGuards.isScope(scopeSymbol)).toBe(true);
    });

    it("returns false for non-scope symbols", () => {
      for (const symbol of allSymbols) {
        if (symbol.kind !== ESymbolKind.Namespace) {
          expect(SymbolGuards.isScope(symbol)).toBe(false);
        }
      }
    });

    it("narrows type correctly", () => {
      const symbol: TSymbol = scopeSymbol;
      if (SymbolGuards.isScope(symbol)) {
        expect(symbol.members).toContain("init");
        expect(symbol.memberVisibility.get("update")).toBe("private");
      }
    });
  });

  describe("isRegister", () => {
    it("returns true for register symbols", () => {
      expect(SymbolGuards.isRegister(registerSymbol)).toBe(true);
    });

    it("returns false for non-register symbols", () => {
      for (const symbol of allSymbols) {
        if (symbol.kind !== ESymbolKind.Register) {
          expect(SymbolGuards.isRegister(symbol)).toBe(false);
        }
      }
    });

    it("narrows type correctly", () => {
      const symbol: TSymbol = registerSymbol;
      if (SymbolGuards.isRegister(symbol)) {
        expect(symbol.baseAddress).toBe("0x40000000");
        expect(symbol.members.get("DATA")?.access).toBe("rw");
      }
    });
  });
});
