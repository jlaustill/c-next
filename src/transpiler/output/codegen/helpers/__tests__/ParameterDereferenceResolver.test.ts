/**
 * Unit tests for ParameterDereferenceResolver
 *
 * Tests the logic for determining when parameters need dereferencing.
 */

import { describe, it, expect, vi } from "vitest";
import ParameterDereferenceResolver from "../ParameterDereferenceResolver";
import type IParameterDereferenceDeps from "../../types/IParameterDereferenceDeps";
import type TParameterInfo from "../../types/TParameterInfo";

describe("ParameterDereferenceResolver", () => {
  // Helper to create mock dependencies
  function createMockDeps(
    overrides: Partial<IParameterDereferenceDeps> = {},
  ): IParameterDereferenceDeps {
    return {
      isFloatType: vi.fn(() => false),
      isKnownPrimitive: vi.fn(() => true),
      knownEnums: new Set<string>(),
      isParameterPassByValue: vi.fn(() => false),
      currentFunctionName: "testFunc",
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
      const deps = createMockDeps();
      const param = createParamInfo({ isCallback: true });

      expect(ParameterDereferenceResolver.isPassByValue(param, deps)).toBe(
        true,
      );
    });

    it("should return true for float parameters (f32)", () => {
      const deps = createMockDeps({
        isFloatType: vi.fn(() => true),
      });
      const param = createParamInfo({ baseType: "f32" });

      expect(ParameterDereferenceResolver.isPassByValue(param, deps)).toBe(
        true,
      );
      expect(deps.isFloatType).toHaveBeenCalledWith("f32");
    });

    it("should return true for float parameters (f64)", () => {
      const deps = createMockDeps({
        isFloatType: vi.fn(() => true),
      });
      const param = createParamInfo({ baseType: "f64" });

      expect(ParameterDereferenceResolver.isPassByValue(param, deps)).toBe(
        true,
      );
    });

    it("should return true for enum parameters", () => {
      const deps = createMockDeps({
        knownEnums: new Set(["Status", "State"]),
      });
      const param = createParamInfo({ baseType: "Status" });

      expect(ParameterDereferenceResolver.isPassByValue(param, deps)).toBe(
        true,
      );
    });

    it("should return true for string parameters", () => {
      const deps = createMockDeps();
      const param = createParamInfo({ isString: true });

      expect(ParameterDereferenceResolver.isPassByValue(param, deps)).toBe(
        true,
      );
    });

    it("should return true for small unmodified primitives (pass-by-value optimization)", () => {
      const deps = createMockDeps({
        isParameterPassByValue: vi.fn(() => true),
        currentFunctionName: "myFunc",
      });
      const param = createParamInfo({ name: "value" });

      expect(ParameterDereferenceResolver.isPassByValue(param, deps)).toBe(
        true,
      );
      expect(deps.isParameterPassByValue).toHaveBeenCalledWith(
        "myFunc",
        "value",
      );
    });

    it("should return true for struct parameters", () => {
      const deps = createMockDeps();
      const param = createParamInfo({ isStruct: true, baseType: "Point" });

      expect(ParameterDereferenceResolver.isPassByValue(param, deps)).toBe(
        true,
      );
    });

    it("should return true for array parameters", () => {
      const deps = createMockDeps();
      const param = createParamInfo({ isArray: true });

      expect(ParameterDereferenceResolver.isPassByValue(param, deps)).toBe(
        true,
      );
    });

    it("should return true for unknown types (external enums, typedefs)", () => {
      const deps = createMockDeps({
        isKnownPrimitive: vi.fn(() => false),
      });
      const param = createParamInfo({ baseType: "ExternalType" });

      expect(ParameterDereferenceResolver.isPassByValue(param, deps)).toBe(
        true,
      );
    });

    it("should return false for known primitives that are pass-by-reference", () => {
      const deps = createMockDeps({
        isKnownPrimitive: vi.fn(() => true),
        isParameterPassByValue: vi.fn(() => false),
      });
      const param = createParamInfo({ baseType: "u32" });

      expect(ParameterDereferenceResolver.isPassByValue(param, deps)).toBe(
        false,
      );
    });

    it("should not check pass-by-value when not in a function", () => {
      const isParameterPassByValue = vi.fn(() => true);
      const deps = createMockDeps({
        isParameterPassByValue,
        currentFunctionName: null,
      });
      const param = createParamInfo();

      // Should still return false because currentFunctionName is null
      // (falls through to isKnownPrimitive check)
      ParameterDereferenceResolver.isPassByValue(param, deps);

      expect(isParameterPassByValue).not.toHaveBeenCalled();
    });
  });

  describe("resolve", () => {
    it("should return bare id for pass-by-value parameters", () => {
      const deps = createMockDeps();
      const param = createParamInfo({ isCallback: true });

      const result = ParameterDereferenceResolver.resolve("cb", param, deps);

      expect(result).toBe("cb");
    });

    it("should dereference known primitive parameters", () => {
      const deps = createMockDeps({
        maybeDereference: vi.fn((id) => `(*${id})`),
      });
      const param = createParamInfo({ baseType: "u32" });

      const result = ParameterDereferenceResolver.resolve("val", param, deps);

      expect(result).toBe("(*val)");
      expect(deps.maybeDereference).toHaveBeenCalledWith("val");
    });

    it("should use maybeDereference for C++ mode handling", () => {
      // In C++ mode, maybeDereference returns the bare identifier
      const deps = createMockDeps({
        maybeDereference: vi.fn((id) => id), // C++ mode - no dereference
      });
      const param = createParamInfo({ baseType: "u32" });

      const result = ParameterDereferenceResolver.resolve("val", param, deps);

      expect(result).toBe("val");
    });

    it("should not dereference float parameters", () => {
      const deps = createMockDeps({
        isFloatType: vi.fn(() => true),
      });
      const param = createParamInfo({ baseType: "f32" });

      const result = ParameterDereferenceResolver.resolve("x", param, deps);

      expect(result).toBe("x");
    });

    it("should not dereference enum parameters", () => {
      const deps = createMockDeps({
        knownEnums: new Set(["State"]),
      });
      const param = createParamInfo({ baseType: "State" });

      const result = ParameterDereferenceResolver.resolve("s", param, deps);

      expect(result).toBe("s");
    });

    it("should not dereference struct parameters", () => {
      const deps = createMockDeps();
      const param = createParamInfo({ isStruct: true, baseType: "Point" });

      const result = ParameterDereferenceResolver.resolve("p", param, deps);

      expect(result).toBe("p");
    });

    it("should not dereference array parameters", () => {
      const deps = createMockDeps();
      const param = createParamInfo({ isArray: true });

      const result = ParameterDereferenceResolver.resolve("arr", param, deps);

      expect(result).toBe("arr");
    });
  });

  describe("priority ordering", () => {
    it("should check callback before float", () => {
      const deps = createMockDeps({
        isFloatType: vi.fn(() => true),
      });
      const param = createParamInfo({ isCallback: true, baseType: "f32" });

      expect(ParameterDereferenceResolver.isPassByValue(param, deps)).toBe(
        true,
      );
      // isFloatType should not be called since callback check comes first
      expect(deps.isFloatType).not.toHaveBeenCalled();
    });

    it("should check enum before pass-by-value optimization", () => {
      const deps = createMockDeps({
        knownEnums: new Set(["Status"]),
        isParameterPassByValue: vi.fn(() => false),
      });
      const param = createParamInfo({ baseType: "Status" });

      expect(ParameterDereferenceResolver.isPassByValue(param, deps)).toBe(
        true,
      );
      // Should not reach pass-by-value check
      expect(deps.isParameterPassByValue).not.toHaveBeenCalled();
    });
  });
});
