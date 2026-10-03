import { describe, it, expect, vi } from "vitest";
import SimpleIdentifierResolver from "../SimpleIdentifierResolver";
import ISimpleIdentifierDeps from "../../types/ISimpleIdentifierDeps";
import TParameterInfo from "../../../../../types/TParameterInfo";

/** Where the reference is -- the binding's position (#1668) */
const AT = { line: 3, column: 4 };

describe("SimpleIdentifierResolver", () => {
  const createMockDeps = (
    overrides: Partial<ISimpleIdentifierDeps> = {},
  ): ISimpleIdentifierDeps => ({
    getParameterInfo: vi.fn(() => undefined),
    resolveParameter: vi.fn((name) => name),
    resolveBareIdentifier: vi.fn(() => null),
    ...overrides,
  });

  describe("resolve", () => {
    it("should return original identifier when not a parameter and no resolution", () => {
      const deps = createMockDeps();

      const result = SimpleIdentifierResolver.resolve("myVar", deps, AT);

      expect(result).toBe("myVar");
      expect(deps.getParameterInfo).toHaveBeenCalledWith("myVar");
      expect(deps.resolveBareIdentifier).toHaveBeenCalledWith("myVar", AT);
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

      const result = SimpleIdentifierResolver.resolve("count", deps, AT);

      expect(result).toBe("(*count)");
      expect(deps.resolveParameter).toHaveBeenCalledWith("count", paramInfo);
      // Should not call bare identifier resolution for parameters
      expect(deps.resolveBareIdentifier).not.toHaveBeenCalled();
    });

    it("binds the name where the reference is (#1668)", () => {
      // Locality is the binding's at this position, not a flag the caller
      // computes from a per-function set of names
      const deps = createMockDeps();

      SimpleIdentifierResolver.resolve("localVar", deps, AT);

      expect(deps.resolveBareIdentifier).toHaveBeenCalledWith("localVar", AT);
    });

    it("should return resolved identifier when bare resolution succeeds", () => {
      const deps = createMockDeps({
        resolveBareIdentifier: vi.fn(() => "Scope_member"),
      });

      const result = SimpleIdentifierResolver.resolve("member", deps, AT);

      expect(result).toBe("Scope_member");
    });

    it("should return original identifier when bare resolution returns null", () => {
      const deps = createMockDeps({
        resolveBareIdentifier: vi.fn(() => null),
      });

      const result = SimpleIdentifierResolver.resolve("unknown", deps, AT);

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

      const result = SimpleIdentifierResolver.resolve("x", deps, AT);

      // Parameter takes priority
      expect(result).toBe("(*x)");
      expect(deps.resolveBareIdentifier).not.toHaveBeenCalled();
    });
  });
});
