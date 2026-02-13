import { describe, it, expect } from "vitest";
import SymbolGuards from "../SymbolGuards";
import type TSymbol from "../TSymbol";
import type IFunctionSymbol from "../IFunctionSymbol";
import type IStructSymbol from "../IStructSymbol";
import ESourceLanguage from "../../../../utils/types/ESourceLanguage";

describe("SymbolGuards", () => {
  // Helper to create a minimal mock symbol
  const createMockSymbol = (kind: string): TSymbol => {
    const mockScope = { kind: "scope" } as unknown;
    (mockScope as { scope: unknown }).scope = mockScope;

    return {
      kind,
      name: "test",
      scope: mockScope,
      sourceFile: "test.cnx",
      sourceLine: 1,
      sourceLanguage: ESourceLanguage.CNext,
      isExported: true,
    } as TSymbol;
  };

  it("isFunction returns true for function symbols", () => {
    const funcSymbol = {
      ...createMockSymbol("function"),
      parameters: [],
      returnType: { kind: "primitive", primitive: "void" },
      visibility: "public",
      body: null,
    } as IFunctionSymbol;

    expect(SymbolGuards.isFunction(funcSymbol)).toBe(true);
    expect(SymbolGuards.isStruct(funcSymbol)).toBe(false);
  });

  it("isStruct returns true for struct symbols", () => {
    const structSymbol = {
      ...createMockSymbol("struct"),
      fields: new Map(),
    } as IStructSymbol;

    expect(SymbolGuards.isStruct(structSymbol)).toBe(true);
    expect(SymbolGuards.isFunction(structSymbol)).toBe(false);
  });

  it("all guards return false for non-matching kinds", () => {
    const funcSymbol = createMockSymbol("function") as TSymbol;

    expect(SymbolGuards.isScope(funcSymbol)).toBe(false);
    expect(SymbolGuards.isEnum(funcSymbol)).toBe(false);
    expect(SymbolGuards.isVariable(funcSymbol)).toBe(false);
    expect(SymbolGuards.isBitmap(funcSymbol)).toBe(false);
    expect(SymbolGuards.isRegister(funcSymbol)).toBe(false);
  });
});
