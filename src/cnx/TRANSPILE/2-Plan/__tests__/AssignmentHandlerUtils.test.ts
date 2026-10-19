/**
 * Unit tests for AssignmentHandlerUtils
 */

import { describe, it, expect } from "vitest";
import AssignmentHandlerUtils from "../AssignmentHandlerUtils";

describe("AssignmentHandlerUtils", () => {
  // #1322: compound assignment on a bit index, bit range, slice or string is
  // E0857 in pass 2.1 -- one decision where this was six throws with four
  // messages, and where this helper was defined a second time, verbatim, in
  // `BitAccessHandlers`. Covered by
  // `1-Analyze/__tests__/CompoundAssignmentAnalyzer.test.ts`.

  describe("validateWriteOnlyValue (an assertion since #1322: E0872 owns the rule)", () => {
    it("passes a non-zero or non-constant value", () => {
      expect(() =>
        AssignmentHandlerUtils.validateWriteOnlyValue(1, "true", "REG", "5"),
      ).not.toThrow();
      expect(() =>
        AssignmentHandlerUtils.validateWriteOnlyValue(
          undefined,
          "v",
          "REG",
          "0, 8",
        ),
      ).not.toThrow();
    });

    it("rejects a value that folds to zero, however it is spelled", () => {
      for (const spelling of ["false", "0", "0x0", "!true", "OFF"]) {
        expect(() =>
          AssignmentHandlerUtils.validateWriteOnlyValue(
            0,
            spelling,
            "REG",
            "5",
          ),
        ).toThrow("E0872 rejects");
      }
    });
  });
});
