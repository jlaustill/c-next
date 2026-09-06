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
    ["k_malloc", "a Zephyr allocator"],
    ["k_free", "its Zephyr counterpart"],
    [
      "my_free",
      "a hand-written equivalent (ADR-003: 'user-defined equivalents')",
    ],
  ])("matches %s -- %s", (name) => {
    expect(DynamicAllocation.matches(name)).toBe(true);
  });

  // The rule's reach, asserted rather than described. These are REAL allocators
  // and every one escapes it: camelCase has no separator to key on, and newlib's
  // reentrant form puts the listed name at the FRONT. An earlier version of this
  // file asserted `pvPort_malloc` instead -- a name FreeRTOS does not use, so a
  // passing test lent credibility to a claim about the rule's coverage that was
  // not true (#1306 review).
  it.each([
    ["pvPortMalloc", "FreeRTOS -- camelCase, no separator"],
    ["vPortFree", "FreeRTOS -- camelCase, no separator"],
    ["osMemoryPoolAlloc", "CMSIS-RTOS -- camelCase, and not a listed name"],
    ["tx_byte_allocate", "ThreadX -- separator, but not a listed name"],
    ["_malloc_r", "newlib -- listed name is a PREFIX, not a suffix"],
  ])("does NOT match %s (%s)", (name) => {
    expect(DynamicAllocation.matches(name)).toBe(false);
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
