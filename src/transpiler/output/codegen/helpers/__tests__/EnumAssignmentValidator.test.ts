/**
 * Unit tests for EnumAssignmentValidator
 *
 * Issue #644: Tests for the extracted enum assignment validator.
 * Rewritten for static class pattern using CodeGenState.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import EnumAssignmentValidator from "../EnumAssignmentValidator.js";
import CodeGenState from "../../CodeGenState.js";
import EnumTypeResolver from "../../resolution/EnumTypeResolver.js";
import ICodeGenSymbols from "../../../../types/ICodeGenSymbols.js";

describe("EnumAssignmentValidator", () => {
  const createMockSymbols = (
    overrides: Partial<ICodeGenSymbols> = {},
  ): ICodeGenSymbols =>
    ({
      knownScopes: new Set(),
      knownEnums: new Set(),
      knownBitmaps: new Set(),
      knownStructs: new Set(),
      knownRegisters: new Set(),
      bitmapBitWidth: new Map(),
      bitmapFields: new Map(),
      bitmapBackingType: new Map(),
      enumMembers: new Map(),
      structFields: new Map(),
      structFieldArrays: new Map(),
      structFieldDimensions: new Map(),
      functionReturnTypes: new Map(),
      scopeMembers: new Map(),
      scopeMemberVisibility: new Map(),
      scopedRegisters: new Map(),
      registerMemberAccess: new Map(),
      registerMemberTypes: new Map(),
      registerBaseAddresses: new Map(),
      registerMemberOffsets: new Map(),
      registerMemberCTypes: new Map(),
      scopeVariableUsage: new Map(),
      scopePrivateConstValues: new Map(),
      getSingleFunctionForVariable: () => null,
      hasPublicSymbols: () => false,
      ...overrides,
    }) as ICodeGenSymbols;

  beforeEach(() => {
    CodeGenState.reset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("validateEnumAssignment", () => {
    it("does nothing for non-enum types", () => {
      CodeGenState.symbols = createMockSymbols();
      const expression = { getText: () => "42" } as never;

      expect(() =>
        EnumAssignmentValidator.validateEnumAssignment("u32", expression),
      ).not.toThrow();
    });

    it("throws for assigning different enum type", () => {
      CodeGenState.symbols = createMockSymbols({
        knownEnums: new Set(["Color", "Status"]),
      });
      vi.spyOn(EnumTypeResolver, "resolve").mockReturnValue("Status");

      const expression = { getText: () => "Status.OK" } as never;

      expect(() =>
        EnumAssignmentValidator.validateEnumAssignment("Color", expression),
      ).toThrow("Cannot assign Status enum to Color enum");
    });

    it("throws for assigning integer to enum", () => {
      CodeGenState.symbols = createMockSymbols({
        knownEnums: new Set(["Color"]),
      });
      vi.spyOn(EnumTypeResolver, "resolve").mockReturnValue(null);

      const expression = { getText: () => "42" } as never;

      expect(() =>
        EnumAssignmentValidator.validateEnumAssignment("Color", expression),
      ).toThrow("Cannot assign integer to Color enum");
    });

    it("allows same enum type assignment", () => {
      CodeGenState.symbols = createMockSymbols({
        knownEnums: new Set(["Color"]),
      });
      vi.spyOn(EnumTypeResolver, "resolve").mockReturnValue("Color");

      const expression = { getText: () => "Color.RED" } as never;

      expect(() =>
        EnumAssignmentValidator.validateEnumAssignment("Color", expression),
      ).not.toThrow();
    });

    it("allows direct enum member access", () => {
      CodeGenState.symbols = createMockSymbols({
        knownEnums: new Set(["Color"]),
      });
      vi.spyOn(EnumTypeResolver, "resolve").mockReturnValue(null);

      const expression = { getText: () => "Color.RED" } as never;

      expect(() =>
        EnumAssignmentValidator.validateEnumAssignment("Color", expression),
      ).not.toThrow();
    });

    it("allows this.Enum.MEMBER pattern", () => {
      CodeGenState.currentScope = "MyScope";
      CodeGenState.symbols = createMockSymbols({
        knownEnums: new Set(["MyScope_State"]),
      });
      vi.spyOn(EnumTypeResolver, "resolve").mockReturnValue(null);

      const expression = { getText: () => "this.State.ACTIVE" } as never;

      expect(() =>
        EnumAssignmentValidator.validateEnumAssignment(
          "MyScope_State",
          expression,
        ),
      ).not.toThrow();
    });

    it("allows global.Enum.MEMBER pattern", () => {
      CodeGenState.symbols = createMockSymbols({
        knownEnums: new Set(["Color"]),
      });
      vi.spyOn(EnumTypeResolver, "resolve").mockReturnValue(null);

      const expression = { getText: () => "global.Color.RED" } as never;

      expect(() =>
        EnumAssignmentValidator.validateEnumAssignment("Color", expression),
      ).not.toThrow();
    });

    it("throws for global.WrongEnum.MEMBER pattern", () => {
      CodeGenState.symbols = createMockSymbols({
        knownEnums: new Set(["Color", "Status"]),
      });
      vi.spyOn(EnumTypeResolver, "resolve").mockReturnValue(null);

      const expression = { getText: () => "global.Status.OK" } as never;

      expect(() =>
        EnumAssignmentValidator.validateEnumAssignment("Color", expression),
      ).toThrow("Cannot assign non-enum value to Color enum");
    });

    it("allows global.structVar.enumField (non-enum parts[1])", () => {
      CodeGenState.symbols = createMockSymbols({
        knownEnums: new Set(["EValueId"]),
      });
      vi.spyOn(EnumTypeResolver, "resolve").mockReturnValue(null);

      const expression = {
        getText: () => "global.input.assignedValue",
      } as never;

      // Should NOT throw — parts[1] "input" is not a known enum
      expect(() =>
        EnumAssignmentValidator.validateEnumAssignment("EValueId", expression),
      ).not.toThrow();
    });

    it("allows scoped enum pattern", () => {
      CodeGenState.symbols = createMockSymbols({
        knownEnums: new Set(["Scope_State"]),
      });
      vi.spyOn(EnumTypeResolver, "resolve").mockReturnValue(null);

      const expression = { getText: () => "Scope.State.ACTIVE" } as never;

      expect(() =>
        EnumAssignmentValidator.validateEnumAssignment(
          "Scope_State",
          expression,
        ),
      ).not.toThrow();
    });

    it("throws for wrong scoped enum pattern", () => {
      CodeGenState.symbols = createMockSymbols({
        knownEnums: new Set(["Scope_State"]),
      });
      vi.spyOn(EnumTypeResolver, "resolve").mockReturnValue(null);

      const expression = { getText: () => "Other.State.ACTIVE" } as never;

      expect(() =>
        EnumAssignmentValidator.validateEnumAssignment(
          "Scope_State",
          expression,
        ),
      ).toThrow("Cannot assign non-enum value to Scope_State enum");
    });

    it("throws for this.WrongEnum.MEMBER with wrong scoped name", () => {
      CodeGenState.currentScope = "MyScope";
      CodeGenState.symbols = createMockSymbols({
        knownEnums: new Set(["MyScope_State"]),
      });
      vi.spyOn(EnumTypeResolver, "resolve").mockReturnValue(null);

      const expression = { getText: () => "this.Wrong.ACTIVE" } as never;

      expect(() =>
        EnumAssignmentValidator.validateEnumAssignment(
          "MyScope_State",
          expression,
        ),
      ).toThrow("Cannot assign non-enum value to MyScope_State enum");
    });

    it("throws for variable.field access on non-enum type", () => {
      CodeGenState.symbols = createMockSymbols({
        knownEnums: new Set(["Color"]),
      });
      vi.spyOn(EnumTypeResolver, "resolve").mockReturnValue(null);

      const expression = { getText: () => "someVar.field" } as never;

      expect(() =>
        EnumAssignmentValidator.validateEnumAssignment("Color", expression),
      ).toThrow("Cannot assign non-enum value to Color enum");
    });

    it("allows variable.field when variable is a known enum", () => {
      CodeGenState.symbols = createMockSymbols({
        knownEnums: new Set(["Color", "Status"]),
      });
      vi.spyOn(EnumTypeResolver, "resolve").mockReturnValue(null);

      const expression = { getText: () => "Status.OK" } as never;

      expect(() =>
        EnumAssignmentValidator.validateEnumAssignment("Color", expression),
      ).not.toThrow();
    });
  });

  describe("isIntegerExpression", () => {
    it("returns true for decimal literals", () => {
      expect(
        EnumAssignmentValidator.isIntegerExpression({
          getText: () => "42",
        } as never),
      ).toBe(true);
    });

    it("returns true for hex literals", () => {
      expect(
        EnumAssignmentValidator.isIntegerExpression({
          getText: () => "0xFF",
        } as never),
      ).toBe(true);
    });

    it("returns true for binary literals", () => {
      expect(
        EnumAssignmentValidator.isIntegerExpression({
          getText: () => "0b1010",
        } as never),
      ).toBe(true);
    });

    it("returns true for integer-typed variable", () => {
      CodeGenState.typeRegistry.set("count", {
        baseType: "u32",
        bitWidth: 32,
        isArray: false,
        isConst: false,
      });

      expect(
        EnumAssignmentValidator.isIntegerExpression({
          getText: () => "count",
        } as never),
      ).toBe(true);
    });

    it("returns false for enum-typed variable", () => {
      CodeGenState.typeRegistry.set("state", {
        baseType: "State",
        bitWidth: 0,
        isArray: false,
        isConst: false,
        isEnum: true,
        enumTypeName: "State",
      });

      expect(
        EnumAssignmentValidator.isIntegerExpression({
          getText: () => "state",
        } as never),
      ).toBe(false);
    });

    it("returns false for non-integer expression", () => {
      expect(
        EnumAssignmentValidator.isIntegerExpression({
          getText: () => "foo.bar",
        } as never),
      ).toBe(false);
    });
  });
});
