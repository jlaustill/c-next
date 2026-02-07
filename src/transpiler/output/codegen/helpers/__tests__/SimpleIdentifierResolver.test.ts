import { describe, it, expect, vi } from "vitest";
import SimpleIdentifierResolver from "../SimpleIdentifierResolver";
import ISimpleIdentifierDeps from "../../types/ISimpleIdentifierDeps";
import TParameterInfo from "../../types/TParameterInfo";

describe("SimpleIdentifierResolver", () => {
  const createMockDeps = (
    overrides: Partial<ISimpleIdentifierDeps> = {},
  ): ISimpleIdentifierDeps => ({
    getParameterInfo: vi.fn(() => undefined),
    resolveParameter: vi.fn((name) => name),
    isLocalVariable: vi.fn(() => false),
    resolveBareIdentifier: vi.fn(() => null),
    ...overrides,
  });

  describe("resolve", () => {
    it("should return original identifier when not a parameter and no resolution", () => {
      const deps = createMockDeps();

      const result = SimpleIdentifierResolver.resolve("myVar", deps);

      expect(result).toBe("myVar");
      expect(deps.getParameterInfo).toHaveBeenCalledWith("myVar");
      expect(deps.isLocalVariable).toHaveBeenCalledWith("myVar");
      expect(deps.resolveBareIdentifier).toHaveBeenCalledWith("myVar", false);
    });

    it("should resolve parameter using resolveParameter", () => {
      const paramInfo: TParameterInfo = {
        name: "count",
        baseType: "u32",
        isArray: false,
        isStruct: false,
        isConst: false,
        isCallback: false,
        isString: false,
      };
      const deps = createMockDeps({
        getParameterInfo: vi.fn(() => paramInfo),
        resolveParameter: vi.fn(() => "(*count)"),
      });

      const result = SimpleIdentifierResolver.resolve("count", deps);

      expect(result).toBe("(*count)");
      expect(deps.resolveParameter).toHaveBeenCalledWith("count", paramInfo);
      // Should not call bare identifier resolution for parameters
      expect(deps.resolveBareIdentifier).not.toHaveBeenCalled();
    });

    it("should pass isLocalVariable flag to resolveBareIdentifier", () => {
      const deps = createMockDeps({
        isLocalVariable: vi.fn(() => true),
      });

      SimpleIdentifierResolver.resolve("localVar", deps);

      expect(deps.resolveBareIdentifier).toHaveBeenCalledWith("localVar", true);
    });

    it("should return resolved identifier when bare resolution succeeds", () => {
      const deps = createMockDeps({
        resolveBareIdentifier: vi.fn(() => "Scope_member"),
      });

      const result = SimpleIdentifierResolver.resolve("member", deps);

      expect(result).toBe("Scope_member");
    });

    it("should return original identifier when bare resolution returns null", () => {
      const deps = createMockDeps({
        resolveBareIdentifier: vi.fn(() => null),
      });

      const result = SimpleIdentifierResolver.resolve("unknown", deps);

      expect(result).toBe("unknown");
    });

    it("should prioritize parameter resolution over bare identifier", () => {
      const paramInfo: TParameterInfo = {
        name: "x",
        baseType: "i32",
        isArray: false,
        isStruct: false,
        isConst: false,
        isCallback: false,
        isString: false,
      };
      const deps = createMockDeps({
        getParameterInfo: vi.fn(() => paramInfo),
        resolveParameter: vi.fn(() => "(*x)"),
        resolveBareIdentifier: vi.fn(() => "Scope_x"),
      });

      const result = SimpleIdentifierResolver.resolve("x", deps);

      // Parameter takes priority
      expect(result).toBe("(*x)");
      expect(deps.resolveBareIdentifier).not.toHaveBeenCalled();
    });
  });
});
