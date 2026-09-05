import { describe, expect, it } from "vitest";

import DynamicAllocation from "../DynamicAllocation";

/**
 * #1306 review. This predicate replaced two different ones that disagreed on
 * real programs, so the cases that exposed the disagreement are pinned here.
 */
describe("DynamicAllocation.matches", () => {
  it.each(DynamicAllocation.names())("matches %s exactly", (name) => {
    expect(DynamicAllocation.matches(name)).toBe(true);
  });

  it("covers aligned_alloc, which ADR-003 names and the old list omitted", () => {
    // It was rejected before only because nothing declared it, so adding it to
    // the known-function table would have quietly legalized the heap.
    expect(DynamicAllocation.matches("aligned_alloc")).toBe(true);
  });

  it.each([
    ["heap_caps_malloc", "an ESP-IDF allocator"],
    ["pvPort_malloc", "an RTOS-style wrapper"],
    [
      "my_free",
      "a hand-written equivalent (ADR-003: 'user-defined equivalents')",
    ],
  ])("matches %s -- %s", (name) => {
    expect(DynamicAllocation.matches(name)).toBe(true);
  });

  // The separator is what makes the rule safe. Without it these were rejected
  // as `free`/`realloc`, which is valid C-Next refused by the transpiler.
  it.each([
    ["myfree"],
    ["saferealloc"],
    ["free_list_init"],
    ["mallocation"],
    ["strdupe"],
  ])("leaves %s alone", (name) => {
    expect(DynamicAllocation.matches(name)).toBe(false);
  });

  it.each([["abs"], ["strchr"], ["fopen"], ["strlen"], ["printf"]])(
    "leaves ordinary library function %s alone",
    (name) => {
      expect(DynamicAllocation.matches(name)).toBe(false);
    },
  );

  it("does not match a name that merely starts with a listed one", () => {
    expect(DynamicAllocation.matches("free_the_pool")).toBe(false);
  });
});
