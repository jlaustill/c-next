/**
 * What 1.3 records about a file's functions for ADR-006: each one's
 * parameter names, in order, under its C name.
 */
import { describe, expect, it } from "vitest";
import parse from "./testHelpers";
import ParameterListCollector from "../collectors/ParameterListCollector";
import ProgramLowering from "../../../2-Parse/ProgramLowering";

function collect(code: string) {
  return ParameterListCollector.collect(
    ProgramLowering.program(parse(code), null),
    (scopeName) => `Outer.${scopeName}`,
  );
}

describe("ParameterListCollector", () => {
  it("records each function's parameter names, in order", () => {
    const lists = collect("void f(u32 a, u32 b) { } void g() { }");
    expect(lists.get("f")).toEqual(["a", "b"]);
    expect(lists.get("g")).toEqual([]);
  });

  it("records a scope's function under its qualified name, outer path included", () => {
    const lists = collect("scope S { public void h(u8 x) { } }");
    expect([...lists.keys()]).toEqual(["Outer__S__h"]);
    expect(lists.get("Outer__S__h")).toEqual(["x"]);
  });
});
