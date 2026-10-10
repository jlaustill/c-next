import { describe, expect, it } from "vitest";

import CPointerArgumentAnalyzer from "../CPointerArgumentAnalyzer";
import type IOperandType from "../../../types/IOperandType";
import type TValueBinding from "../../../types/TValueBinding";

const declared = (fields: Partial<IOperandType>): IOperandType =>
  ({
    typeName: null,
    stringCapacity: null,
    form: { kind: "declared" },
    ...fields,
  }) as IOperandType;

describe("CPointerArgumentAnalyzer (#1977)", () => {
  it("gives a declared value its C type", () => {
    const cTypeOf = CPointerArgumentAnalyzer.cTypeOf;
    expect(cTypeOf(declared({ typeName: "u32" }))).toBe("uint32_t");
    expect(cTypeOf(declared({ typeName: "R" }))).toBe("R");
    expect(cTypeOf(declared({ typeName: "string", stringCapacity: 8 }))).toBe(
      "char",
    );
  });

  it("asks nothing of a literal, an untyped value or no type", () => {
    const cTypeOf = CPointerArgumentAnalyzer.cTypeOf;
    expect(cTypeOf(null)).toBeNull();
    expect(cTypeOf(declared({}))).toBeNull();
    expect(
      cTypeOf(declared({ typeName: "u8", form: { kind: "call" } })),
    ).toBeNull();
  });

  it("reads const from the declaration a chain starts at", () => {
    const isConstRoot = CPointerArgumentAnalyzer.isConstRoot;
    expect(isConstRoot(null)).toBeNull();
    expect(
      isConstRoot({
        kind: "local",
        declaration: { isConst: true },
        scopePath: "",
      } as unknown as TValueBinding),
    ).toBe(true);
    expect(
      isConstRoot({
        kind: "variable",
        symbol: { isConst: false },
      } as unknown as TValueBinding),
    ).toBe(false);
  });
});
