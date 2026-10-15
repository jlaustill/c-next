/**
 * What 1.3 records about a file's functions for const inference: which
 * parameters each function writes, and which calls pass a parameter on. It
 * reads statements from the lowered tree (#2003), so a write or call nested
 * anywhere in a body is found.
 */
import { describe, expect, it } from "vitest";
import parse from "./testHelpers";
import ModificationCollector from "../collectors/ModificationCollector";
import ProgramLowering from "../../../2-Parse/ProgramLowering";

function collect(code: string) {
  return ModificationCollector.collect(
    ProgramLowering.program(parse(code), null),
    (scopeName) => scopeName,
  );
}

function modified(code: string, fn: string): string[] {
  return [...(collect(code).modifiedParameters.get(fn) ?? [])];
}

function calls(code: string, fn: string) {
  return collect(code).calls.get(fn) ?? [];
}

describe("ModificationCollector", () => {
  it("records each function's parameter list", () => {
    const facts = collect("void f(u32 a, u32 b) { }");
    expect(facts.functionParamLists.get("f")).toEqual(["a", "b"]);
  });

  it("records a write to a parameter nested in other statements", () => {
    const code = `
      void f(mut u32 a, mut u32 b) {
        while (b > 0) {
          if (b = 1) { a <- 2; }
          b -<- 1;
        }
      }
    `;
    expect(modified(code, "f").sort()).toEqual(["a", "b"]);
  });

  it("does not record a `global.` write to a same-spelled name (#1290)", () => {
    const code = `
      mut u32 a <- 0;
      void f(u32 a) { global.a <- 2; }
    `;
    expect(modified(code, "f")).toEqual([]);
  });

  it("records a call in a for header that passes a parameter on", () => {
    const code = `
      u32 g(u32 x) { return x; }
      void f(u32 a) {
        for (u32 i <- 0; i < g(a); i +<- 1) { }
      }
    `;
    expect(calls(code, "f")).toEqual([
      { callee: "g", calleeIsBare: true, paramIndex: 0, argParamName: "a" },
    ]);
  });

  it("records a call in a for update", () => {
    const code = `
      u32 g(u32 x) { return x; }
      void f(u32 a) {
        for (mut u32 i <- 0; i < 3; i <- g(a)) { }
      }
    `;
    expect(calls(code, "f").map((c) => c.callee)).toEqual(["g"]);
  });

  it("records scope-qualified, this- and cast-wrapped calls by C name", () => {
    const code = `
      scope S {
        public void set(mut u32 x) { x <- 1; }
        public void viaThis(mut u32 a) { this.set(a); }
      }
      void viaScope(mut u32 a) { S.set(a); }
      void viaCast(mut u32 a) { (void) S.set(a); }
    `;
    expect(calls(code, "S__viaThis").map((c) => c.callee)).toEqual(["S__set"]);
    expect(calls(code, "viaScope")).toEqual([
      {
        callee: "S__set",
        calleeIsBare: false,
        paramIndex: 0,
        argParamName: "a",
      },
    ]);
    expect(calls(code, "viaCast").map((c) => c.callee)).toEqual(["S__set"]);
  });

  it("records a call nested in another call's argument", () => {
    const code = `
      u32 g(u32 x) { return x; }
      u32 h(u32 x) { return x; }
      u32 f(u32 a) { return h(g(a) + 1); }
    `;
    expect(calls(code, "f").map((c) => c.callee)).toEqual(["g"]);
  });
});
