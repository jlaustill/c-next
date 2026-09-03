import { describe, it, expect } from "vitest";
import type IBaseSymbol from "../IBaseSymbol";
import type TSymbolKindCNext from "../../symbol-kinds/TSymbolKindCNext";
import ESourceLanguage from "../../../../utils/types/ESourceLanguage";
import ScopeUtils from "../../../../utils/ScopeUtils";
import TestSymbolUtils from "../../../logic/symbols/cnext/__tests__/testSymbolUtils";
import TestSourceSpan from "../../__testUtils__/testSourceSpan";

describe("IBaseSymbol", () => {
  it("accepts valid symbol with TSymbolKindCNext kind", () => {
    // Built through the shared factory rather than a bare object literal, so
    // the identity pair is computed by `ScopeUtils.identityOf` from `scopePath`
    // exactly as a collector computes it -- never hand-written.

    const symbol: IBaseSymbol = {
      ...TestSymbolUtils.base({
        kind: "function" as TSymbolKindCNext,
        name: "testFunc",
        scopePath: "",
        sourceFile: "test.cnx",
        span: TestSourceSpan.at(10),
      }),
    };

    expect(symbol.kind).toBe("function");
    expect(symbol.name).toBe("testFunc");
    expect(symbol.sourceLanguage).toBe(ESourceLanguage.CNext);
    expect(ScopeUtils.isGlobalScopePath(symbol.scopePath)).toBe(true);
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
