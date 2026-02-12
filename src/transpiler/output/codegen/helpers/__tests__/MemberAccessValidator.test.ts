/**
 * Unit tests for MemberAccessValidator
 *
 * Tests for the shared validation utility extracted from
 * CodeGenerator.generateMemberAccess() and PostfixExpressionGenerator.
 */

import { describe, it, expect } from "vitest";
import MemberAccessValidator from "../MemberAccessValidator.js";

describe("MemberAccessValidator", () => {
  describe("validateRegisterReadAccess", () => {
    it("throws for write-only register member", () => {
      const registerMemberAccess = new Map([["GPIO7_DR", "wo"]]);

      expect(() =>
        MemberAccessValidator.validateRegisterReadAccess(
          "GPIO7_DR",
          "DR",
          "GPIO7.DR",
          registerMemberAccess,
          false,
        ),
      ).toThrow(
        "cannot read from write-only register member 'DR' (GPIO7.DR has 'wo' access modifier)",
      );
    });

    it("does NOT throw when isAssignmentTarget is true", () => {
      const registerMemberAccess = new Map([["GPIO7_DR", "wo"]]);

      expect(() =>
        MemberAccessValidator.validateRegisterReadAccess(
          "GPIO7_DR",
          "DR",
          "GPIO7.DR",
          registerMemberAccess,
          true,
        ),
      ).not.toThrow();
    });

    it("does NOT throw for rw access modifier", () => {
      const registerMemberAccess = new Map([["GPIO7_DR", "rw"]]);

      expect(() =>
        MemberAccessValidator.validateRegisterReadAccess(
          "GPIO7_DR",
          "DR",
          "GPIO7.DR",
          registerMemberAccess,
          false,
        ),
      ).not.toThrow();
    });

    it("does NOT throw for ro access modifier", () => {
      const registerMemberAccess = new Map([["GPIO7_SR", "ro"]]);

      expect(() =>
        MemberAccessValidator.validateRegisterReadAccess(
          "GPIO7_SR",
          "SR",
          "GPIO7.SR",
          registerMemberAccess,
          false,
        ),
      ).not.toThrow();
    });

    it("does NOT throw when register key is not in the map", () => {
      const registerMemberAccess = new Map<string, string>();

      expect(() =>
        MemberAccessValidator.validateRegisterReadAccess(
          "GPIO7_DR",
          "DR",
          "GPIO7.DR",
          registerMemberAccess,
          false,
        ),
      ).not.toThrow();
    });
  });

  describe("validateNotSelfScopeReference", () => {
    it("throws when scopeName matches currentScope", () => {
      expect(() =>
        MemberAccessValidator.validateNotSelfScopeReference(
          "Motor",
          "speed",
          "Motor",
        ),
      ).toThrow(
        "Error: Cannot reference own scope 'Motor' by name. Use 'this.speed' instead of 'Motor.speed'",
      );
    });

    it("does NOT throw when currentScope is null", () => {
      expect(() =>
        MemberAccessValidator.validateNotSelfScopeReference(
          "Motor",
          "speed",
          null,
        ),
      ).not.toThrow();
    });

    it("does NOT throw when scope names differ", () => {
      expect(() =>
        MemberAccessValidator.validateNotSelfScopeReference(
          "Motor",
          "speed",
          "Sensor",
        ),
      ).not.toThrow();
    });
  });

  describe("validateGlobalEntityAccess", () => {
    it("throws when in scope and entity name conflicts with scope member", () => {
      const scopeMembers = new Map([["Motor", new Set(["Color", "speed"])]]);
      expect(() =>
        MemberAccessValidator.validateGlobalEntityAccess(
          "Color",
          "Red",
          "enum",
          "Motor",
          false,
          scopeMembers,
        ),
      ).toThrow(
        "Use 'global.Color.Red' to access enum 'Color' from inside scope 'Motor'",
      );
    });

    it("does NOT throw when in scope but no naming conflict", () => {
      const scopeMembers = new Map([["Motor", new Set(["speed"])]]);
      expect(() =>
        MemberAccessValidator.validateGlobalEntityAccess(
          "Color",
          "Red",
          "enum",
          "Motor",
          false,
          scopeMembers,
        ),
      ).not.toThrow();
    });

    it("does NOT throw when isGlobalAccess is true even with conflict", () => {
      const scopeMembers = new Map([["Motor", new Set(["Color"])]]);
      expect(() =>
        MemberAccessValidator.validateGlobalEntityAccess(
          "Color",
          "Red",
          "enum",
          "Motor",
          true,
          scopeMembers,
        ),
      ).not.toThrow();
    });

    it("does NOT throw when entity belongs to current scope", () => {
      expect(() =>
        MemberAccessValidator.validateGlobalEntityAccess(
          "Motor_State",
          "Running",
          "enum",
          "Motor",
          false,
        ),
      ).not.toThrow();
    });

    it("does NOT throw when currentScope is null", () => {
      expect(() =>
        MemberAccessValidator.validateGlobalEntityAccess(
          "Color",
          "Red",
          "enum",
          null,
          false,
        ),
      ).not.toThrow();
    });

    it("throws for register with naming conflict", () => {
      const scopeMembers = new Map([["Motor", new Set(["GPIO"])]]);
      expect(() =>
        MemberAccessValidator.validateGlobalEntityAccess(
          "GPIO",
          "PIN0",
          "register",
          "Motor",
          false,
          scopeMembers,
        ),
      ).toThrow(
        "Use 'global.GPIO.PIN0' to access register 'GPIO' from inside scope 'Motor'",
      );
    });

    it("does NOT throw for register without naming conflict", () => {
      const scopeMembers = new Map([["Motor", new Set(["speed"])]]);
      expect(() =>
        MemberAccessValidator.validateGlobalEntityAccess(
          "GPIO",
          "PIN0",
          "register",
          "Motor",
          false,
          scopeMembers,
        ),
      ).not.toThrow();
    });

    it("does NOT throw when scopeMembers is undefined", () => {
      expect(() =>
        MemberAccessValidator.validateGlobalEntityAccess(
          "Color",
          "Red",
          "enum",
          "Motor",
          false,
          undefined,
        ),
      ).not.toThrow();
    });
  });
});
