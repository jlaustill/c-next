import { describe, expect, it } from "vitest";

import TypeHead from "../../../../cnx/utils/TypeHead";
import type TSymbol from "../../../../cnx/types/symbols/TSymbol";

describe("TypeHead", () => {
  it("names a primitive keyword's type, but not void's", () => {
    expect(TypeHead.primitive("u32")).toEqual({
      kind: "primitive",
      primitive: "u32",
    });
    expect(TypeHead.primitive("void")).toBeNull();
    expect(TypeHead.primitive("Point")).toBeNull();
  });

  it("names a struct, enum or bitmap symbol's type, and no other", () => {
    const of = (kind: string, extra = {}) =>
      TypeHead.ofSymbol({ kind, ...extra } as unknown as TSymbol, "Geo_Box");
    expect(of("struct")).toEqual({ kind: "struct", name: "Geo_Box" });
    expect(of("enum")).toEqual({ kind: "enum", name: "Geo_Box" });
    expect(of("bitmap", { bitWidth: 8 })).toEqual({
      kind: "bitmap",
      name: "Geo_Box",
      bitWidth: 8,
    });
    expect(of("variable")).toBeNull();
    expect(TypeHead.ofSymbol(undefined, "Geo_Box")).toBeNull();
  });
});
