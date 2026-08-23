import { describe, it, expect } from "vitest";
import type IBaseSymbol from "../IBaseSymbol";
import type TSymbolKindCNext from "../../symbol-kinds/TSymbolKindCNext";
import ESourceLanguage from "../../../../utils/types/ESourceLanguage";
import ScopeUtils from "../../../../utils/ScopeUtils";

describe("IBaseSymbol", () => {
  it("accepts valid symbol with TSymbolKindCNext kind", () => {
    // `scope` is an IScopeSymbol, so use the real factory rather than a bare
    // object literal — a symbol's scope always carries the parent chain that
    // ScopeUtils.getTranspiledCName walks.
    const scope = ScopeUtils.createGlobalScope();

    const symbol: IBaseSymbol = {
      kind: "function" as TSymbolKindCNext,
      name: "testFunc",
      scope,
      sourceFile: "test.cnx",
      sourceLine: 10,
      sourceLanguage: ESourceLanguage.CNext,
      isExported: true,
    };

    expect(symbol.kind).toBe("function");
    expect(symbol.name).toBe("testFunc");
    expect(symbol.sourceLanguage).toBe(ESourceLanguage.CNext);
    expect(ScopeUtils.isGlobalScope(symbol.scope)).toBe(true);
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
