/**
 * Unit tests for EnumAssignmentValidator
 *
 * Issue #644: Tests for the extracted enum assignment validator.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import EnumAssignmentValidator from "../EnumAssignmentValidator.js";

describe("EnumAssignmentValidator", () => {
  let knownEnums: Set<string>;
  let validator: EnumAssignmentValidator;

  beforeEach(() => {
    knownEnums = new Set(["Color", "Status", "Scope_State"]);

    validator = new EnumAssignmentValidator({
      knownEnums,
      getCurrentScope: vi.fn(() => null),
      getExpressionEnumType: vi.fn(() => null),
      isIntegerExpression: vi.fn(() => false),
    });
  });

  describe("validateEnumAssignment", () => {
    it("does nothing for non-enum types", () => {
      const expression = { getText: () => "42" } as never;

      // Should not throw for non-enum type
      expect(() =>
        validator.validateEnumAssignment("u32", expression),
      ).not.toThrow();
    });

    it("throws for assigning different enum type", () => {
      const validator = new EnumAssignmentValidator({
        knownEnums,
        getCurrentScope: () => null,
        getExpressionEnumType: () => "Status", // Value is Status type
        isIntegerExpression: () => false,
      });

      const expression = { getText: () => "Status.OK" } as never;

      expect(() =>
        validator.validateEnumAssignment("Color", expression),
      ).toThrow("Cannot assign Status enum to Color enum");
    });

    it("throws for assigning integer to enum", () => {
      const validator = new EnumAssignmentValidator({
        knownEnums,
        getCurrentScope: () => null,
        getExpressionEnumType: () => null,
        isIntegerExpression: () => true, // Expression is integer
      });

      const expression = { getText: () => "42" } as never;

      expect(() =>
        validator.validateEnumAssignment("Color", expression),
      ).toThrow("Cannot assign integer to Color enum");
    });

    it("allows same enum type assignment", () => {
      const validator = new EnumAssignmentValidator({
        knownEnums,
        getCurrentScope: () => null,
        getExpressionEnumType: () => "Color", // Value is Color type
        isIntegerExpression: () => false,
      });

      const expression = { getText: () => "Color.RED" } as never;

      expect(() =>
        validator.validateEnumAssignment("Color", expression),
      ).not.toThrow();
    });

    it("allows direct enum member access", () => {
      const expression = { getText: () => "Color.RED" } as never;

      expect(() =>
        validator.validateEnumAssignment("Color", expression),
      ).not.toThrow();
    });

    it("allows this.Enum.MEMBER pattern", () => {
      const validator = new EnumAssignmentValidator({
        knownEnums: new Set(["MyScope_State"]),
        getCurrentScope: () => "MyScope",
        getExpressionEnumType: () => null,
        isIntegerExpression: () => false,
      });

      const expression = { getText: () => "this.State.ACTIVE" } as never;

      expect(() =>
        validator.validateEnumAssignment("MyScope_State", expression),
      ).not.toThrow();
    });

    it("allows global.Enum.MEMBER pattern", () => {
      const expression = { getText: () => "global.Color.RED" } as never;

      expect(() =>
        validator.validateEnumAssignment("Color", expression),
      ).not.toThrow();
    });

    it("throws for global.WrongEnum.MEMBER pattern", () => {
      const expression = { getText: () => "global.Status.OK" } as never;

      expect(() =>
        validator.validateEnumAssignment("Color", expression),
      ).toThrow("Cannot assign non-enum value to Color enum");
    });

    it("allows scoped enum pattern", () => {
      const expression = { getText: () => "Scope.State.ACTIVE" } as never;

      expect(() =>
        validator.validateEnumAssignment("Scope_State", expression),
      ).not.toThrow();
    });

    it("throws for wrong scoped enum pattern", () => {
      const expression = { getText: () => "Other.State.ACTIVE" } as never;

      expect(() =>
        validator.validateEnumAssignment("Scope_State", expression),
      ).toThrow("Cannot assign non-enum value to Scope_State enum");
    });

    it("throws for this.WrongEnum.MEMBER with wrong scoped name", () => {
      const validator = new EnumAssignmentValidator({
        knownEnums: new Set(["MyScope_State"]),
        getCurrentScope: () => "MyScope",
        getExpressionEnumType: () => null,
        isIntegerExpression: () => false,
      });

      const expression = { getText: () => "this.Wrong.ACTIVE" } as never;

      expect(() =>
        validator.validateEnumAssignment("MyScope_State", expression),
      ).toThrow("Cannot assign non-enum value to MyScope_State enum");
    });

    it("throws for variable.field access on non-enum type", () => {
      const expression = { getText: () => "someVar.field" } as never;

      expect(() =>
        validator.validateEnumAssignment("Color", expression),
      ).toThrow("Cannot assign non-enum value to Color enum");
    });

    it("allows variable.field when variable is a known enum", () => {
      const expression = { getText: () => "Status.OK" } as never;

      expect(() =>
        validator.validateEnumAssignment("Color", expression),
      ).not.toThrow();
    });
  });
});
