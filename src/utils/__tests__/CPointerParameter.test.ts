import { describe, expect, it } from "vitest";

import CPointerParameter from "../CPointerParameter";

const param = (type: string, isConst = false) => ({
  name: "p",
  type,
  isConst,
  isArray: false,
});

describe("CPointerParameter (#1977)", () => {
  it("reads what a one-pointer parameter points to, without qualifiers", () => {
    expect(CPointerParameter.pointee("const uint8_t*")).toBe("uint8_t");
    expect(CPointerParameter.pointee("volatile const R *")).toBe("R");
    expect(CPointerParameter.pointee("void*")).toBe("void");
  });

  it("asks nothing of a value or a pointer to a pointer", () => {
    expect(CPointerParameter.pointee("uint32_t")).toBeNull();
    expect(CPointerParameter.pointee("Dev**")).toBeNull();
    expect(CPointerParameter.pointee(undefined)).toBeNull();
  });

  it("knows a parameter that points to const, however the const is recorded", () => {
    expect(CPointerParameter.pointsToConst(param("const uint8_t*"))).toBe(true);
    expect(CPointerParameter.pointsToConst(param("uint8_t*", true))).toBe(true);
    expect(CPointerParameter.pointsToConst(param("uint8_t*"))).toBe(false);
  });
});
