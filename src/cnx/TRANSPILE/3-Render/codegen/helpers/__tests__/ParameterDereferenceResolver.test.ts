/**
 * Unit tests for ParameterDereferenceResolver
 *
 * Tests the logic for determining when parameters need dereferencing.
 */

import { describe, it, expect, vi } from "vitest";
import ParameterDereferenceResolver from "../ParameterDereferenceResolver";
import type IParameterDereferenceDeps from "../../types/IParameterDereferenceDeps";
import type TParameterInfo from "../../../../../types/TParameterInfo";

describe("ParameterDereferenceResolver", () => {
  // Helper to create mock dependencies
  function createMockDeps(
    overrides: Partial<IParameterDereferenceDeps> = {},
  ): IParameterDereferenceDeps {
    return {
      maybeDereference: vi.fn((id) => `(*${id})`),
      ...overrides,
    };
  }

  // Helper to create parameter info
  function createParamInfo(
    overrides: Partial<TParameterInfo> = {},
  ): TParameterInfo {
    return {
      name: "param",
      baseType: "u32",
      isArray: false,
      isStruct: false,
      isConst: false,
      isCallback: false,
      isString: false,
      ...overrides,
    };
  }

  describe("isPassByValue", () => {
    it("should return true for callback parameters", () => {
      const param = createParamInfo({ isCallback: true });

      expect(ParameterDereferenceResolver.isPassByValue(param)).toBe(true);
    });

    it("should return true for a read-only float (ADR-071 Q6)", () => {
      const param = createParamInfo({ isPassByValue: true, baseType: "f32" });

      expect(ParameterDereferenceResolver.isPassByValue(param)).toBe(true);
    });

    it("should return false for a `mut` float (ADR-071 Q6)", () => {
      const param = createParamInfo({ baseType: "f64" });

      expect(ParameterDereferenceResolver.isPassByValue(param)).toBe(false);
    });

    it("should return true for a read-only enum", () => {
      const param = createParamInfo({
        isPassByValue: true,
        baseType: "Status",
      });

      expect(ParameterDereferenceResolver.isPassByValue(param)).toBe(true);
    });

    it("should return true for string parameters", () => {
      const param = createParamInfo({ isString: true });

      expect(ParameterDereferenceResolver.isPassByValue(param)).toBe(true);
    });

    it("should return true for small unmodified primitives (pass-by-value optimization)", () => {
      const param = createParamInfo({ isPassByValue: true, name: "value" });

      expect(ParameterDereferenceResolver.isPassByValue(param)).toBe(true);
    });

    it("should return true for struct parameters", () => {
      const param = createParamInfo({ isStruct: true, baseType: "Point" });

      expect(ParameterDereferenceResolver.isPassByValue(param)).toBe(true);
    });

    it("should return true for array parameters", () => {
      const param = createParamInfo({ isArray: true });

      expect(ParameterDereferenceResolver.isPassByValue(param)).toBe(true);
    });

    it("should return true for unknown types (external enums, typedefs)", () => {
      const param = createParamInfo({
        isPassByValue: true,
        baseType: "ExternalType",
      });

      expect(ParameterDereferenceResolver.isPassByValue(param)).toBe(true);
    });

    it("should return false for known primitives that are pass-by-reference", () => {
      const param = createParamInfo({ baseType: "u32" });

      expect(ParameterDereferenceResolver.isPassByValue(param)).toBe(false);
    });
  });

  describe("resolve", () => {
    it("should return bare id for pass-by-value parameters", () => {
      const deps = createMockDeps();
      const param = createParamInfo({ isCallback: true });

      const result = ParameterDereferenceResolver.resolve(
        { info: param, emittedName: "cb" },
        deps,
      );

      expect(result).toBe("cb");
    });

    it("should dereference known primitive parameters", () => {
      const deps = createMockDeps({
        maybeDereference: vi.fn((id) => `(*${id})`),
      });
      const param = createParamInfo({ baseType: "u32" });

      const result = ParameterDereferenceResolver.resolve(
        { info: param, emittedName: "val" },
        deps,
      );

      expect(result).toBe("(*val)");
      expect(deps.maybeDereference).toHaveBeenCalledWith("val");
    });

    it("should use maybeDereference for C++ mode handling", () => {
      // In C++ mode, maybeDereference returns the bare identifier
      const deps = createMockDeps({
        maybeDereference: vi.fn((id) => id), // C++ mode - no dereference
      });
      const param = createParamInfo({ baseType: "u32" });

      const result = ParameterDereferenceResolver.resolve(
        { info: param, emittedName: "val" },
        deps,
      );

      expect(result).toBe("val");
    });

    it("should dereference a `mut` float", () => {
      const deps = createMockDeps();
      const param = createParamInfo({ baseType: "f32" });

      const result = ParameterDereferenceResolver.resolve(
        { info: param, emittedName: "x" },
        deps,
      );

      expect(result).toBe("(*x)");
    });

    it("should dereference a `mut` enum, which is not an unknown type", () => {
      const deps = createMockDeps();
      const param = createParamInfo({ baseType: "State" });

      const result = ParameterDereferenceResolver.resolve(
        { info: param, emittedName: "s" },
        deps,
      );

      expect(result).toBe("(*s)");
    });

    it("should not dereference an enum array, which is already a pointer", () => {
      const deps = createMockDeps();
      const param = createParamInfo({ baseType: "State", isArray: true });

      const result = ParameterDereferenceResolver.resolve(
        { info: param, emittedName: "states" },
        deps,
      );

      expect(result).toBe("states");
    });

    it("should not dereference struct parameters", () => {
      const deps = createMockDeps();
      const param = createParamInfo({ isStruct: true, baseType: "Point" });

      const result = ParameterDereferenceResolver.resolve(
        { info: param, emittedName: "p" },
        deps,
      );

      expect(result).toBe("p");
    });

    it("should not dereference array parameters", () => {
      const deps = createMockDeps();
      const param = createParamInfo({ isArray: true });

      const result = ParameterDereferenceResolver.resolve(
        { info: param, emittedName: "arr" },
        deps,
      );

      expect(result).toBe("arr");
    });
  });

  describe("priority ordering", () => {
    it("should check callback before float", () => {
      const param = createParamInfo({ isCallback: true, baseType: "f32" });

      expect(ParameterDereferenceResolver.isPassByValue(param)).toBe(true);
    });

    it("should check a read-only enum's declaration before its enum-ness", () => {
      const param = createParamInfo({
        isPassByValue: true,
        baseType: "Status",
      });

      expect(ParameterDereferenceResolver.isPassByValue(param)).toBe(true);
    });
  });
});
