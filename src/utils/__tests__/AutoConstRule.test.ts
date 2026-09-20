import { describe, it, expect } from "vitest";
import AutoConstRule from "../AutoConstRule";
import IAutoConstFacts from "../types/IAutoConstFacts";

/**
 * The facts of a parameter auto-const DOES apply to, so each test below can
 * change exactly the one fact it is about and nothing else.
 */
function facts(overrides: Partial<IAutoConstFacts> = {}): IAutoConstFacts {
  return {
    baseType: "u32",
    isModified: false,
    isExplicitlyConst: false,
    isCallbackCompatible: false,
    isArray: false,
    isKnownEnum: false,
    isOpaqueHandle: false,
    ...overrides,
  };
}

describe("AutoConstRule", () => {
  it("applies to an unmodified non-array pointer parameter", () => {
    expect(AutoConstRule.applies(facts())).toBe(true);
  });

  /**
   * Each exclusion gets its own case rather than one table, because the point
   * of the file is that the rule holds ALL of them: three of these could not
   * change any generated output when they were written, since
   * ParameterSignatureBuilder routes pass-by-value parameters to a branch that
   * ignores isAutoConst. A guard nothing can observe is a guard nothing can
   * fail, so the assertion lives here instead of waiting for a fixture that
   * cannot exist.
   */
  it.each([
    ["explicitly const in the source", { isExplicitlyConst: true }],
    ["assigned to a C callback typedef (#895)", { isCallbackCompatible: true }],
    ["modified by the body", { isModified: true }],
    ["an array (#986, ADR-006)", { isArray: true }],
    ["f32, which is passed by value", { baseType: "f32" }],
    ["f64, which is passed by value", { baseType: "f64" }],
    ["ISR, a function pointer not a data pointer", { baseType: "ISR" }],
    ["a known enum, passed by value", { isKnownEnum: true }],
  ])("does not apply when the parameter is %s", (_why, override) => {
    expect(AutoConstRule.applies(facts(override))).toBe(false);
  });

  it("refuses a callback parameter even when every other fact allows it", () => {
    // Guard order carries NO meaning here: every guard in `applies` returns
    // false, so the result is identical under any permutation of them. This
    // asserts the answer, not a path to it.
    //
    // ADR-013's escape hatch is NOT implemented by this rule reaching one
    // guard before another -- an explicitly const parameter and a callback
    // parameter both return false. It is implemented in
    // ParameterSignatureBuilder._getConstPrefix, which ORs `isConst` in
    // independently of `isAutoConst`. That is asserted in that file's own
    // tests, where it can actually fail.
    expect(
      AutoConstRule.applies(
        facts({ isCallbackCompatible: true, isExplicitlyConst: true }),
      ),
    ).toBe(false);
  });

  it("refuses an opaque handle, the exclusion that used to live in the builder", () => {
    // #995. Before this fact reached the rule, ParameterSignatureBuilder was
    // the only thing that knew -- so a reader of AutoConstRule counted six
    // exclusions and the code had seven.
    expect(AutoConstRule.applies(facts({ isOpaqueHandle: true }))).toBe(false);
  });

  it("treats a string<N> as an ordinary pointer parameter", () => {
    // ADR-045 renders it `char*`, so it is exactly the shape auto-const is for.
    expect(AutoConstRule.applies(facts({ baseType: "string<32>" }))).toBe(true);
  });
});
