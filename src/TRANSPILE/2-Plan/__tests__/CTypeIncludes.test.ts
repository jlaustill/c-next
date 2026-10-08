/**
 * #1927: the one predicate for `<stdint.h>` / `<stdbool.h>`, asked by both the
 * `.c` (`EmissionPlan`) and the `.h` (`HeaderIncludes`).
 */

import CTypeIncludes from "../CTypeIncludes";

describe("CTypeIncludes.decide (#1927)", () => {
  it.each([
    ["uint8_t", ["<stdint.h>"]],
    ["int64_t", ["<stdint.h>"]],
    ["uintptr_t", ["<stdint.h>"]],
    ["bool", ["<stdbool.h>"]],
    ["float", []],
    ["double", []],
    ["char*", []],
    ["void", []],
  ])("%s decides %j", (cType, expected) => {
    expect(CTypeIncludes.decide([cType])).toEqual(expected);
  });

  it("decides nothing from no types", () => {
    expect(CTypeIncludes.decide([])).toEqual([]);
  });

  it("orders stdint before stdbool whatever order the types come in", () => {
    expect(CTypeIncludes.decide(["bool", "uint16_t"])).toEqual([
      "<stdint.h>",
      "<stdbool.h>",
    ]);
  });

  it("asks once per header, not once per type", () => {
    expect(CTypeIncludes.decide(["uint8_t", "uint16_t", "int32_t"])).toEqual([
      "<stdint.h>",
    ]);
  });

  // `baseTypeOf` strips decoration with index arithmetic rather than regular
  // expressions (S5852), so the shapes it must see through are pinned.
  it.each([
    ["a pointer", "uint8_t*"],
    ["a spaced pointer", "uint8_t *"],
    ["an array", "uint16_t[4]"],
    ["a const qualifier", "const uint32_t"],
  ])("sees through %s", (_label, cType) => {
    expect(CTypeIncludes.decide([cType])).toEqual(["<stdint.h>"]);
  });

  it("does not match a user type whose name merely contains a C type", () => {
    expect(CTypeIncludes.decide(["uint8_t_wrapper", "boolean"])).toEqual([]);
  });
});
