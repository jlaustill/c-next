import { describe, expect, it } from "vitest";

import CPointerArgumentAnalyzer from "../CPointerArgumentAnalyzer";
import type IOperandType from "../../../types/IOperandType";

const declared = (fields: Partial<IOperandType>): IOperandType =>
  ({
    typeName: null,
    stringCapacity: null,
    form: { kind: "declared" },
    ...fields,
  }) as IOperandType;

describe("CPointerArgumentAnalyzer (#1977)", () => {
  it("reads what a one-pointer parameter points to, without qualifiers", () => {
    expect(CPointerArgumentAnalyzer.pointee("const uint8_t*")).toBe("uint8_t");
    expect(CPointerArgumentAnalyzer.pointee("volatile const R *")).toBe("R");
    expect(CPointerArgumentAnalyzer.pointee("void*")).toBe("void");
  });

  it("asks nothing of a value or a pointer to a pointer", () => {
    expect(CPointerArgumentAnalyzer.pointee("uint32_t")).toBeNull();
    expect(CPointerArgumentAnalyzer.pointee("Dev**")).toBeNull();
    expect(CPointerArgumentAnalyzer.pointee(undefined)).toBeNull();
  });

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
});
