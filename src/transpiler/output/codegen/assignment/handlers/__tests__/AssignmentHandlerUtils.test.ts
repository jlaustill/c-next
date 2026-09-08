/**
 * Unit tests for AssignmentHandlerUtils
 */

import { describe, it, expect } from "vitest";
import AssignmentHandlerUtils from "../AssignmentHandlerUtils";
import SymbolRegistry from "../../../../../state/SymbolRegistry";
import ScopeUtils from "../../../../../../utils/ScopeUtils";

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

  describe("buildScopedRegisterName", () => {
    it("should join scope and parts with underscores", () => {
      const result = AssignmentHandlerUtils.buildScopedRegisterName("Motor", [
        "GPIO7",
        "DR_SET",
      ]);
      expect(result).toBe("Motor__GPIO7__DR_SET");
    });

    it("should handle single part", () => {
      const result = AssignmentHandlerUtils.buildScopedRegisterName("Scope", [
        "REG",
      ]);
      expect(result).toBe("Scope__REG");
    });

    it("keeps the outer scope for a nested declaring scope", () => {
      // #1285: the previous signature took a scope NAME, so the caller in
      // RegisterHandlers read `.name` off the scope symbol it already held and
      // dropped every outer component. Passing the symbol keeps the chain.
      SymbolRegistry.getOrCreateScope("Board");
      const inner = ScopeUtils.createScope("Teensy4", "Board");
      const result = AssignmentHandlerUtils.buildScopedRegisterName(
        ScopeUtils.pathOf(inner),
        ["GPIO7", "DR_SET"],
      );
      expect(result).toBe("Board__Teensy4__GPIO7__DR_SET");
    });
  });

  describe("buildRegisterNameWithScopeDetection", () => {
    const mockIsKnownScope = (name: string) => name === "Motor";

    it("should detect scoped register with 3+ identifiers", () => {
      const result = AssignmentHandlerUtils.buildRegisterNameWithScopeDetection(
        ["Motor", "GPIO7", "DR_SET"],
        mockIsKnownScope,
      );
      expect(result).toEqual({
        fullName: "Motor__GPIO7__DR_SET",
        regName: "Motor__GPIO7",
        isScoped: true,
      });
    });

    it("should detect non-scoped register when first identifier is not a scope", () => {
      const result = AssignmentHandlerUtils.buildRegisterNameWithScopeDetection(
        ["GPIO7", "DR_SET"],
        mockIsKnownScope,
      );
      expect(result).toEqual({
        fullName: "GPIO7__DR_SET",
        regName: "GPIO7",
        isScoped: false,
      });
    });

    it("should treat as non-scoped with only 2 identifiers even if first is a scope", () => {
      // With only 2 identifiers, it's treated as Register.Member even if first looks like scope
      const result = AssignmentHandlerUtils.buildRegisterNameWithScopeDetection(
        ["Motor", "DR_SET"],
        mockIsKnownScope,
      );
      expect(result).toEqual({
        fullName: "Motor__DR_SET",
        regName: "Motor",
        isScoped: false,
      });
    });
  });
});
