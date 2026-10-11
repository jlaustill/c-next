import { describe, expect, it } from "vitest";

import STRUCT_POINTER_C_FUNCTIONS from "../STRUCT_POINTER_C_FUNCTIONS";

/**
 * Moved from `NullCheckAnalyzer.test.ts` with the constant it covers (#1322).
 * The assertions are unchanged; only the thing they name moved.
 */
describe("STRUCT_POINTER_C_FUNCTIONS", () => {
  it("includes the file-handle functions, which return FILE*", () => {
    expect(STRUCT_POINTER_C_FUNCTIONS.has("fopen")).toBe(true);
    expect(STRUCT_POINTER_C_FUNCTIONS.has("freopen")).toBe(true);
    expect(STRUCT_POINTER_C_FUNCTIONS.has("tmpfile")).toBe(true);
  });

  it("excludes the char*-returning functions, which map to cstring", () => {
    // The distinction is the whole point of the set: codegen adds an asterisk
    // for these and not for those.
    expect(STRUCT_POINTER_C_FUNCTIONS.has("strchr")).toBe(false);
    expect(STRUCT_POINTER_C_FUNCTIONS.has("strstr")).toBe(false);
  });
});
