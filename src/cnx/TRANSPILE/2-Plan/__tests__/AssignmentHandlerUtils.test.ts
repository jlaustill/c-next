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
    describe("single bit access", () => {
      it("should not throw for true value", () => {
        expect(() =>
          AssignmentHandlerUtils.validateWriteOnlyValue(
            "true",
            "REG",
            "5",
            true,
          ),
        ).not.toThrow();
      });

      it("should throw for false value", () => {
        expect(() =>
          AssignmentHandlerUtils.validateWriteOnlyValue(
            "false",
            "REG",
            "5",
            true,
          ),
        ).toThrow("E0872 rejects");
      });

      it("should throw for 0 value", () => {
        expect(() =>
          AssignmentHandlerUtils.validateWriteOnlyValue("0", "REG", "5", true),
        ).toThrow("E0872 rejects");
      });
    });

    describe("bit range access", () => {
      it("should not throw for non-zero value", () => {
        expect(() =>
          AssignmentHandlerUtils.validateWriteOnlyValue(
            "0xFF",
            "REG",
            "0, 8",
            false,
          ),
        ).not.toThrow();
      });

      it("should throw for 0 value", () => {
        expect(() =>
          AssignmentHandlerUtils.validateWriteOnlyValue(
            "0",
            "REG",
            "0, 8",
            false,
          ),
        ).toThrow("E0872 rejects");
      });

      it("should allow false for bit range (multi-bit)", () => {
        // "false" as a string is not "0", so it's allowed for multi-bit
        expect(() =>
          AssignmentHandlerUtils.validateWriteOnlyValue(
            "false",
            "REG",
            "0, 8",
            false,
          ),
        ).not.toThrow();
      });
    });
  });
});
