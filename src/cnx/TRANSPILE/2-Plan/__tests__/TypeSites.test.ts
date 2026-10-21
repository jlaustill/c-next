import { describe, expect, it } from "vitest";

import CnxSourceParser from "../../../PARSE/2-Parse/CnxSourceParser";
import TypeSites from "../TypeSites";

/** Each planned type as `scope:text`, `-` for file level */
const sites = (source: string): string[] => {
  const parsed = CnxSourceParser.parse(source);
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

  it("plans a cast's type inside an expression", () => {
    expect(sites("u32 n <- (u32)i16.type_byte_length;\n").sort()).toEqual([
      "-:u32",
      "-:u32",
    ]);
  });

  it("plans no type for a type's length property, which names no value", () => {
    expect(sites("u32 n <- i16.type_byte_length;\n")).toEqual(["-:u32"]);
  });

  it("plans no parameter type for main's args, which 2.3 writes as argc and argv", () => {
    expect(sites("u32 main(string args[]) {\n  return 0;\n}\n")).toEqual([
      "-:u32",
    ]);
  });

  it("plans no type inside a dimension or enum value, which 1.4 spells", () => {
    expect(
      sites("u8[u64.type_byte_length] buffer;\nenum E { A <- (u32)2.5 }\n"),
    ).toEqual(["-:u8[u64.type_byte_length]"]);
  });

  it("plans no type inside a scope's struct, which the .c takes from the header", () => {
    expect(
      sites(
        "scope S {\n  struct C { u8 a; }\n  enum E { A <- (u8)1 }\n  u16 n;\n}\n",
      ),
    ).toEqual(["S:u16"]);
  });

  it("names the scope a scope member's types are written in", () => {
    expect(
      sites(
        "scope Motor {\n  u8 speed;\n  public void set(i8 v) { }\n}\n",
      ).sort(),
    ).toEqual(["Motor:i8", "Motor:u8", "Motor:void"]);
  });
});
