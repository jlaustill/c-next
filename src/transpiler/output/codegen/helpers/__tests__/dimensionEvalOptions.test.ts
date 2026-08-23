/**
 * Unit tests for dimensionEvalOptions
 * Issue #1127: one place binding ArrayDimensionParser to live codegen state
 */

import { describe, it, expect, afterEach } from "vitest";
import CodeGenState from "../../../../state/CodeGenState";
import TYPE_WIDTH from "../../../../constants/TYPE_WIDTH";
import dimensionEvalOptions from "../dimensionEvalOptions";

describe("dimensionEvalOptions", () => {
  afterEach(() => {
    CodeGenState.reset();
  });

  it("supplies the shared TYPE_WIDTH table", () => {
    // Codegen and symbol collection must fold sizeof against the same widths;
    // supplying a different table is how the two layers came to disagree.
    expect(dimensionEvalOptions().typeWidths).toBe(TYPE_WIDTH);
  });

  it("supplies the live const map rather than a copy", () => {
    // A copy taken at call time would go stale as later consts are registered,
    // so a dimension would fold or not depending on declaration order.
    CodeGenState.registerConstValue("SIZE", 6);
    expect(dimensionEvalOptions().constValues.get("SIZE")).toBe(6);
    expect(dimensionEvalOptions().constValues).toBe(CodeGenState.constValues);
  });

  it("reflects consts registered after an earlier call", () => {
    const before = dimensionEvalOptions();
    CodeGenState.registerConstValue("LATER", 12);
    expect(before.constValues.get("LATER")).toBe(12);
  });

  it("supplies exactly the lookups the evaluator consumes", () => {
    // An isKnownStruct predicate used to be threaded through here. It could
    // not change any answer, so callers that omitted it agreed only because
    // the difference was inert -- the latent divergence this helper exists to
    // prevent. It was removed rather than propagated.
    expect(Object.keys(dimensionEvalOptions()).sort()).toEqual([
      "constValues",
      "typeWidths",
    ]);
  });
});
