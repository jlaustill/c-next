import { describe, it, expect } from "vitest";
import type IBaseSymbol from "../IBaseSymbol";
import type TSymbolKindCNext from "../../symbol-kinds/TSymbolKindCNext";
import ESourceLanguage from "../../../../utils/types/ESourceLanguage";

describe("IBaseSymbol", () => {
  it("accepts valid symbol with TSymbolKindCNext kind", () => {
    // Create a mock scope for circular reference using object literal with self-reference
    const mockScope: IBaseSymbol = {
      kind: "scope",
      name: "global",
      scope: null as unknown as IBaseSymbol, // Will be set after creation
      sourceFile: "test.cnx",
      sourceLine: 1,
      sourceLanguage: ESourceLanguage.CNext,
      isExported: true,
    };
    // Use Object.defineProperty to set the circular reference
    Object.defineProperty(mockScope, "scope", { value: mockScope });

    const symbol: IBaseSymbol = {
      kind: "function" as TSymbolKindCNext,
      name: "testFunc",
      scope: mockScope,
      sourceFile: "test.cnx",
      sourceLine: 10,
      sourceLanguage: ESourceLanguage.CNext,
      isExported: true,
    };

    expect(symbol.kind).toBe("function");
    expect(symbol.name).toBe("testFunc");
    expect(symbol.sourceLanguage).toBe(ESourceLanguage.CNext);
  });

  it("kind field accepts all TSymbolKindCNext values", () => {
    const validKinds: TSymbolKindCNext[] = [
      "function",
      "variable",
      "struct",
      "enum",
      "enum_member",
      "bitmap",
      "bitmap_field",
      "register",
      "register_member",
      "scope",
    ];

    // Type check - if this compiles, the types are correct
    validKinds.forEach((kind) => {
      const partial: Pick<IBaseSymbol, "kind"> = { kind };
      expect(partial.kind).toBe(kind);
    });
  });
});
