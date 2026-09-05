import { describe, it, expect } from "vitest";
import type IBaseSymbol from "../IBaseSymbol";
import type TSymbolKindCNext from "../../symbol-kinds/TSymbolKindCNext";
import ESourceLanguage from "../../../../utils/types/ESourceLanguage";
import ScopeUtils from "../../../../utils/ScopeUtils";
import TestSymbolUtils from "../../../../PARSE/3-Declare/cnext/__tests__/testSymbolUtils";
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
    // #1318 review: this was a `TSymbolKindCNext[]`, which accepts any SUBSET
    // of the union -- so it held 10 of 11 kinds and the compiler was equally
    // happy. It drifted in the very PR that added `struct_field`, which is the
    // #1143 shape: a guard that cannot fail on the case it exists to catch.
    // A Record keyed on the union requires EVERY key, so adding a kind without
    // adding it here is a build failure rather than a silent gap.
    const validKinds: Record<TSymbolKindCNext, true> = {
      function: true,
      variable: true,
      struct: true,
      struct_field: true,
      enum: true,
      enum_member: true,
      bitmap: true,
      bitmap_field: true,
      register: true,
      register_member: true,
      scope: true,
    };

    // Type check - if this compiles, the types are correct
    (Object.keys(validKinds) as TSymbolKindCNext[]).forEach((kind) => {
      const partial: Pick<IBaseSymbol, "kind"> = { kind };
      expect(partial.kind).toBe(kind);
    });
  });
});
