/**
 * Unit tests for MemberSeparatorResolver
 *
 * Tests the logic for determining member access separators.
 */

import { describe, it, expect, vi } from "vitest";
import MemberSeparatorResolver from "../MemberSeparatorResolver";
import type IMemberSeparatorDeps from "../../types/IMemberSeparatorDeps";
import type ISeparatorContext from "../../types/ISeparatorContext";

describe("MemberSeparatorResolver", () => {
  // Helper to create mock dependencies
  function createMockDeps(
    overrides: Partial<IMemberSeparatorDeps> = {},
  ): IMemberSeparatorDeps {
    return {
      isKnownScope: vi.fn(() => false),
      isKnownRegister: vi.fn(() => false),
      validateCrossScopeVisibility: vi.fn(),
      validateRegisterAccess: vi.fn(),
      getStructParamSeparator: vi.fn(() => "->"),
      ...overrides,
    };
  }

  // Helper to create separator context
  function createContext(
    overrides: Partial<ISeparatorContext> = {},
  ): ISeparatorContext {
    return {
      hasGlobal: false,
      isCrossScope: false,
      isStructParam: false,
      isCppAccess: false,
      scopedRegName: null,
      isScopedRegister: false,
      ...overrides,
    };
  }

  describe("buildContext", () => {
    it("should detect cross-scope access for known scopes", () => {
      const deps = createMockDeps({
        isKnownScope: vi.fn(() => true),
      });

      const ctx = MemberSeparatorResolver.buildContext(
        "Motor",
        true, // hasGlobal
        false, // hasThis
        null,
        false, // isStructParam
        deps,
        false, // isCppAccess
      );

      expect(ctx.isCrossScope).toBe(true);
      expect(ctx.hasGlobal).toBe(true);
    });

    it("should detect cross-scope access for known registers", () => {
      const deps = createMockDeps({
        isKnownRegister: vi.fn(() => true),
      });

      const ctx = MemberSeparatorResolver.buildContext(
        "GPIO7",
        true, // hasGlobal
        false, // hasThis
        null,
        false,
        deps,
        false,
      );

      expect(ctx.isCrossScope).toBe(true);
    });

    it("should build scoped register name when using this prefix", () => {
      const deps = createMockDeps({
        isKnownRegister: vi.fn((name) => name === "Motor_CONTROL_REG"),
      });

      const ctx = MemberSeparatorResolver.buildContext(
        "CONTROL_REG",
        false, // hasGlobal
        true, // hasThis
        "Motor", // currentScope
        false,
        deps,
        false,
      );

      expect(ctx.scopedRegName).toBe("Motor_CONTROL_REG");
      expect(ctx.isScopedRegister).toBe(true);
    });

    it("should not build scoped register name without this prefix", () => {
      const deps = createMockDeps();

      const ctx = MemberSeparatorResolver.buildContext(
        "CONTROL_REG",
        false,
        false, // no this
        "Motor",
        false,
        deps,
        false,
      );

      expect(ctx.scopedRegName).toBe(null);
      expect(ctx.isScopedRegister).toBe(false);
    });

    it("should preserve isStructParam flag", () => {
      const deps = createMockDeps();

      const ctx = MemberSeparatorResolver.buildContext(
        "point",
        false,
        false,
        null,
        true, // isStructParam
        deps,
        false,
      );

      expect(ctx.isStructParam).toBe(true);
    });

    it("should preserve isCppAccess flag", () => {
      const deps = createMockDeps();

      const ctx = MemberSeparatorResolver.buildContext(
        "SeaDash",
        true,
        false,
        null,
        false,
        deps,
        true, // isCppAccess
      );

      expect(ctx.isCppAccess).toBe(true);
    });
  });

  describe("getFirstSeparator", () => {
    it("should return :: for C++ namespace access", () => {
      const deps = createMockDeps();
      const ctx = createContext({ isCppAccess: true });

      const sep = MemberSeparatorResolver.getFirstSeparator(
        ["SeaDash"],
        "Parse",
        ctx,
        deps,
      );

      expect(sep).toBe("::");
    });

    it("should return -> for struct param in C mode", () => {
      const deps = createMockDeps({
        getStructParamSeparator: vi.fn(() => "->"),
      });
      const ctx = createContext({ isStructParam: true });

      const sep = MemberSeparatorResolver.getFirstSeparator(
        ["point"],
        "x",
        ctx,
        deps,
      );

      expect(sep).toBe("->");
    });

    it("should return . for struct param in C++ mode", () => {
      const deps = createMockDeps({
        getStructParamSeparator: vi.fn(() => "."),
      });
      const ctx = createContext({ isStructParam: true });

      const sep = MemberSeparatorResolver.getFirstSeparator(
        ["point"],
        "x",
        ctx,
        deps,
      );

      expect(sep).toBe(".");
    });

    it("should return _ for cross-scope access", () => {
      const deps = createMockDeps();
      const ctx = createContext({ isCrossScope: true });

      const sep = MemberSeparatorResolver.getFirstSeparator(
        ["Motor"],
        "speed",
        ctx,
        deps,
      );

      expect(sep).toBe("_");
    });

    it("should return _ for global register member access", () => {
      const deps = createMockDeps({
        isKnownRegister: vi.fn(() => true),
      });
      const ctx = createContext({ hasGlobal: true });

      const sep = MemberSeparatorResolver.getFirstSeparator(
        ["GPIO7"],
        "DR_SET",
        ctx,
        deps,
      );

      expect(sep).toBe("_");
    });

    it("should validate visibility and return _ for global scope access", () => {
      const validateCrossScopeVisibility = vi.fn();
      const deps = createMockDeps({
        isKnownScope: vi.fn(() => true),
        validateCrossScopeVisibility,
      });
      const ctx = createContext({ hasGlobal: true });

      const sep = MemberSeparatorResolver.getFirstSeparator(
        ["Motor"],
        "speed",
        ctx,
        deps,
      );

      expect(sep).toBe("_");
      expect(validateCrossScopeVisibility).toHaveBeenCalledWith(
        "Motor",
        "speed",
      );
    });

    it("should return _ for scoped register access", () => {
      const deps = createMockDeps();
      const ctx = createContext({ isScopedRegister: true });

      const sep = MemberSeparatorResolver.getFirstSeparator(
        ["CONTROL_REG"],
        "SPEED",
        ctx,
        deps,
      );

      expect(sep).toBe("_");
    });

    it("should return . for normal struct field access", () => {
      const deps = createMockDeps();
      const ctx = createContext();

      const sep = MemberSeparatorResolver.getFirstSeparator(
        ["point"],
        "x",
        ctx,
        deps,
      );

      expect(sep).toBe(".");
    });
  });

  describe("getSubsequentSeparator", () => {
    it("should return _ when first identifier is a register", () => {
      const deps = createMockDeps({
        isKnownRegister: vi.fn((name) => name === "GPIO7"),
      });
      const ctx = createContext();

      const sep = MemberSeparatorResolver.getSubsequentSeparator(
        ["GPIO7", "DR", "SET"],
        ctx,
        deps,
      );

      expect(sep).toBe("_");
    });

    it("should return _ when chain so far is a register", () => {
      const deps = createMockDeps({
        isKnownRegister: vi.fn((name) => name === "GPIO7_DR"),
      });
      const ctx = createContext();

      const sep = MemberSeparatorResolver.getSubsequentSeparator(
        ["GPIO7", "DR", "SET"],
        ctx,
        deps,
      );

      expect(sep).toBe("_");
    });

    it("should return _ when scoped register name is a register", () => {
      const deps = createMockDeps({
        isKnownRegister: vi.fn((name) => name === "Motor_CONTROL_REG"),
      });
      const ctx = createContext({ scopedRegName: "Motor_CONTROL_REG" });

      const sep = MemberSeparatorResolver.getSubsequentSeparator(
        ["CONTROL_REG", "SPEED"],
        ctx,
        deps,
      );

      expect(sep).toBe("_");
    });

    it("should return . for non-register subsequent access", () => {
      const deps = createMockDeps();
      const ctx = createContext();

      const sep = MemberSeparatorResolver.getSubsequentSeparator(
        ["config", "network", "port"],
        ctx,
        deps,
      );

      expect(sep).toBe(".");
    });
  });

  describe("getSeparator (dispatch)", () => {
    it("should dispatch to getFirstSeparator when isFirstOp is true", () => {
      const deps = createMockDeps();
      const ctx = createContext({ isCppAccess: true });

      const sep = MemberSeparatorResolver.getSeparator(
        true, // isFirstOp
        ["SeaDash"],
        "Parse",
        ctx,
        deps,
      );

      expect(sep).toBe("::");
    });

    it("should dispatch to getSubsequentSeparator when isFirstOp is false", () => {
      const deps = createMockDeps({
        isKnownRegister: vi.fn(() => true),
      });
      const ctx = createContext();

      const sep = MemberSeparatorResolver.getSeparator(
        false, // not first op
        ["GPIO7", "DR"],
        "SET",
        ctx,
        deps,
      );

      expect(sep).toBe("_");
    });
  });

  describe("priority ordering", () => {
    it("should prioritize C++ access over struct param", () => {
      const deps = createMockDeps({
        getStructParamSeparator: vi.fn(() => "->"),
      });
      const ctx = createContext({
        isCppAccess: true,
        isStructParam: true,
      });

      const sep = MemberSeparatorResolver.getFirstSeparator(
        ["obj"],
        "field",
        ctx,
        deps,
      );

      expect(sep).toBe("::");
      expect(deps.getStructParamSeparator).not.toHaveBeenCalled();
    });

    it("should prioritize struct param over cross-scope", () => {
      const deps = createMockDeps({
        getStructParamSeparator: vi.fn(() => "->"),
      });
      const ctx = createContext({
        isStructParam: true,
        isCrossScope: true,
      });

      const sep = MemberSeparatorResolver.getFirstSeparator(
        ["point"],
        "x",
        ctx,
        deps,
      );

      expect(sep).toBe("->");
    });
  });
});
