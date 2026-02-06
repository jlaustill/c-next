/**
 * Unit tests for AssignmentHandlerUtils
 */

import { describe, it, expect } from "vitest";
import AssignmentHandlerUtils from "../AssignmentHandlerUtils";

describe("AssignmentHandlerUtils", () => {
  describe("validateScopeContext", () => {
    it("should not throw for valid scope", () => {
      expect(() =>
        AssignmentHandlerUtils.validateScopeContext("MyScope"),
      ).not.toThrow();
    });

    it("should throw for null scope", () => {
      expect(() => AssignmentHandlerUtils.validateScopeContext(null)).toThrow(
        "Error: 'this' can only be used inside a scope",
      );
    });
  });

  describe("validateNoCompoundForBitAccess", () => {
    it("should not throw for non-compound assignment", () => {
      expect(() =>
        AssignmentHandlerUtils.validateNoCompoundForBitAccess(false, "<-"),
      ).not.toThrow();
    });

    it("should throw for compound assignment", () => {
      expect(() =>
        AssignmentHandlerUtils.validateNoCompoundForBitAccess(true, "+<-"),
      ).toThrow(
        "Compound assignment operators not supported for bit field access: +<-",
      );
    });
  });

  describe("validateWriteOnlyValue", () => {
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
        ).toThrow("Cannot assign false to write-only register bit REG[5]");
      });

      it("should throw for 0 value", () => {
        expect(() =>
          AssignmentHandlerUtils.validateWriteOnlyValue("0", "REG", "5", true),
        ).toThrow("Cannot assign false to write-only register bit REG[5]");
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
        ).toThrow("Cannot assign 0 to write-only register bits REG[0, 8]");
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
      expect(result).toBe("Motor_GPIO7_DR_SET");
    });

    it("should handle single part", () => {
      const result = AssignmentHandlerUtils.buildScopedRegisterName("Scope", [
        "REG",
      ]);
      expect(result).toBe("Scope_REG");
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
        fullName: "Motor_GPIO7_DR_SET",
        regName: "Motor_GPIO7",
        isScoped: true,
      });
    });

    it("should detect non-scoped register when first identifier is not a scope", () => {
      const result = AssignmentHandlerUtils.buildRegisterNameWithScopeDetection(
        ["GPIO7", "DR_SET"],
        mockIsKnownScope,
      );
      expect(result).toEqual({
        fullName: "GPIO7_DR_SET",
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
        fullName: "Motor_DR_SET",
        regName: "Motor",
        isScoped: false,
      });
    });
  });
});
