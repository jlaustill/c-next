import { describe, expect, it } from "vitest";

import CNextSourceParser from "../../../PARSE/2-Parse/CNextSourceParser";
import TypeSites from "../TypeSites";

/** Each planned type as `scope:text`, `-` for file level */
const sites = (source: string): string[] => {
  const parsed = CNextSourceParser.parse(source);
  expect(parsed.parseErrors).toEqual([]);
  return TypeSites.of(parsed.program).map(
    ({ type, scope }) => `${scope ?? "-"}:${type.text}`,
  );
};

describe("TypeSites", () => {
  it("plans a function's return, parameter and local types", () => {
    expect(
      sites("u16 f(u8 a) {\n  i32 n <- 0;\n  return a;\n}\n").sort(),
    ).toEqual(["-:i32", "-:u16", "-:u8"]);
  });

  it("plans a cast's and a sizeof's type inside an expression", () => {
    expect(sites("u32 n <- (u32)sizeof(i16);\n").sort()).toEqual([
      "-:i16",
      "-:u32",
      "-:u32",
    ]);
  });

  it("plans no type for a sizeof of a value", () => {
    expect(sites("u32 n <- sizeof(n + 1);\n")).toEqual(["-:u32"]);
  });

  it("plans a sizeof inside a declared type's dimension", () => {
    expect(sites("u8[sizeof(u64)] buffer;\n").sort()).toEqual([
      "-:u64",
      "-:u8[sizeof(u64)]",
    ]);
  });

  it("names the scope a scope member's types are written in", () => {
    expect(
      sites(
        "scope Motor {\n  u8 speed;\n  public void set(i8 v) { }\n}\n",
      ).sort(),
    ).toEqual(["Motor:i8", "Motor:u8", "Motor:void"]);
  });
});
