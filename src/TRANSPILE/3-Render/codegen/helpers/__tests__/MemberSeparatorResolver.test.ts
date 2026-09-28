/**
 * Unit tests for MemberSeparatorResolver
 *
 * Tests the logic for determining member access separators.
 */

import { describe, it, expect, vi } from "vitest";
import MemberSeparatorResolver from "../MemberSeparatorResolver";
import type IMemberSeparatorDeps from "../../types/IMemberSeparatorDeps";
import type ISeparatorContext from "../../types/ISeparatorContext";
import type IRootHolding from "../../types/IRootHolding";

// How a root is held, as `memberAccessChain.rootHolding` answers it
const NOT_HELD: IRootHolding = {
  isStructParam: false,
  forcePointerSemantics: false,
  isPointerLocal: false,
};
const STRUCT_PARAM: IRootHolding = { ...NOT_HELD, isStructParam: true };
const POINTER_LOCAL: IRootHolding = { ...NOT_HELD, isPointerLocal: true };

describe("MemberSeparatorResolver", () => {
  // Helper to create mock dependencies
  function createMockDeps(
    overrides: Partial<IMemberSeparatorDeps> = {},
  ): IMemberSeparatorDeps {
    return {
      isKnownScope: vi.fn(() => false),
      isKnownRegister: vi.fn(() => false),
      rootMemberSeparator: vi.fn(() => "->"),
      ...overrides,
    };
  }

  // Helper to create separator context
  function createContext(
    overrides: Partial<ISeparatorContext> = {},
  ): ISeparatorContext {
    return {
      isCrossScope: false,
      holding: NOT_HELD,
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
        {
          firstId: "Motor",
          hasGlobal: true,
          hasThis: false,
          currentScopePath: "",
          holding: NOT_HELD,
          isCppAccess: false,
        },
        deps,
      );

      expect(ctx.isCrossScope).toBe(true);
    });

    it("should detect cross-scope access for known registers", () => {
      const deps = createMockDeps({
        isKnownRegister: vi.fn(() => true),
      });

      const ctx = MemberSeparatorResolver.buildContext(
        {
          firstId: "GPIO7",
          hasGlobal: true,
          hasThis: false,
          currentScopePath: "",
          holding: NOT_HELD,
          isCppAccess: false,
        },
        deps,
      );

      expect(ctx.isCrossScope).toBe(true);
    });

    it("should build scoped register name when using this prefix", () => {
      const deps = createMockDeps({
        isKnownRegister: vi.fn((name) => name === "Motor__CONTROL_REG"),
      });

      const ctx = MemberSeparatorResolver.buildContext(
        {
          firstId: "CONTROL_REG",
          hasGlobal: false,
          hasThis: true,
          currentScopePath: "Motor",
          holding: NOT_HELD,
          isCppAccess: false,
        },
        deps,
      );

      expect(ctx.scopedRegName).toBe("Motor__CONTROL_REG");
      expect(ctx.isScopedRegister).toBe(true);
    });

    it("should not build scoped register name without this prefix", () => {
      const deps = createMockDeps();

      const ctx = MemberSeparatorResolver.buildContext(
        {
          firstId: "CONTROL_REG",
          hasGlobal: false,
          hasThis: false,
          currentScopePath: "Motor",
          holding: NOT_HELD,
          isCppAccess: false,
        },
        deps,
      );

      expect(ctx.scopedRegName).toBeNull();
      expect(ctx.isScopedRegister).toBe(false);
    });

    it("should preserve the holding", () => {
      const deps = createMockDeps();

      const ctx = MemberSeparatorResolver.buildContext(
        {
          firstId: "point",
          hasGlobal: false,
          hasThis: false,
          currentScopePath: "",
          holding: STRUCT_PARAM,
          isCppAccess: false,
        },
        deps,
      );

      expect(ctx.holding).toBe(STRUCT_PARAM);
    });

    it("should preserve isCppAccess flag", () => {
      const deps = createMockDeps();

      const ctx = MemberSeparatorResolver.buildContext(
        {
          firstId: "SeaDash",
          hasGlobal: true,
          hasThis: false,
          currentScopePath: "",
          holding: NOT_HELD,
          isCppAccess: true,
        },
        deps,
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
        ctx,
        deps,
      );

      expect(sep).toBe("::");
    });

    it("should return -> for struct param in C mode", () => {
      const deps = createMockDeps({
        rootMemberSeparator: vi.fn(() => "->"),
      });
      const ctx = createContext({ holding: STRUCT_PARAM });

      const sep = MemberSeparatorResolver.getFirstSeparator(
        ["point"],
        ctx,
        deps,
      );

      expect(sep).toBe("->");
    });

    it("should return . for struct param in C++ mode", () => {
      const deps = createMockDeps({
        rootMemberSeparator: vi.fn(() => "."),
      });
      const ctx = createContext({ holding: STRUCT_PARAM });

      const sep = MemberSeparatorResolver.getFirstSeparator(
        ["point"],
        ctx,
        deps,
      );

      expect(sep).toBe(".");
    });

    // Issue #895: whether a callback-promoted parameter is a pointer in C++ is
    // the root-holding helper's decision -- the one the read path reads too --
    // so the holding is handed over, not overridden here. #1760 review: a
    // local #895 made a pointer is held too, and took `.` on the pointer.
    it.each<[string, IRootHolding]>([
      ["a struct parameter", STRUCT_PARAM],
      [
        "a callback-promoted parameter",
        { ...STRUCT_PARAM, forcePointerSemantics: true },
      ],
      ["a local #895 made a pointer", POINTER_LOCAL],
    ])("hands %s's holding to the separator helper", (_label, holding) => {
      const deps = createMockDeps();
      const ctx = createContext({ holding });

      MemberSeparatorResolver.getFirstSeparator(["f"], ctx, deps);

      expect(deps.rootMemberSeparator).toHaveBeenCalledWith(holding);
    });

    it("asks no helper for a root that is not held", () => {
      const deps = createMockDeps();
      MemberSeparatorResolver.getFirstSeparator(["p"], createContext(), deps);
      expect(deps.rootMemberSeparator).not.toHaveBeenCalled();
    });

    it("should return _ for cross-scope access", () => {
      const deps = createMockDeps();
      const ctx = createContext({ isCrossScope: true });

      const sep = MemberSeparatorResolver.getFirstSeparator(
        ["Motor"],
        ctx,
        deps,
      );

      expect(sep).toBe("__");
    });

    it("should return _ for global register member access", () => {
      const deps = createMockDeps({
        isKnownRegister: vi.fn(() => true),
      });
      const ctx = createContext({ isCrossScope: true });

      const sep = MemberSeparatorResolver.getFirstSeparator(
        ["GPIO7"],
        ctx,
        deps,
      );

      expect(sep).toBe("__");
    });

    it("should return _ for a known scope, with or without global.", () => {
      // #1322: the visibility check that used to be asserted here is E0436
      // in pass 2.1; the separator only spells the C name.
      const deps = createMockDeps({
        isKnownScope: vi.fn(() => true),
      });
      const ctx = createContext({ isCrossScope: true });

      const sep = MemberSeparatorResolver.getFirstSeparator(
        ["Motor"],
        ctx,
        deps,
      );

      expect(sep).toBe("__");
    });

    it("should return _ for scoped register access", () => {
      const deps = createMockDeps();
      const ctx = createContext({ isScopedRegister: true });

      const sep = MemberSeparatorResolver.getFirstSeparator(
        ["CONTROL_REG"],
        ctx,
        deps,
      );

      expect(sep).toBe("__");
    });

    it("should return . for normal struct field access", () => {
      const deps = createMockDeps();
      const ctx = createContext();

      const sep = MemberSeparatorResolver.getFirstSeparator(
        ["point"],
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

      expect(sep).toBe("__");
    });

    it("should return _ when chain so far is a register", () => {
      const deps = createMockDeps({
        isKnownRegister: vi.fn((name) => name === "GPIO7__DR"),
      });
      const ctx = createContext();

      const sep = MemberSeparatorResolver.getSubsequentSeparator(
        ["GPIO7", "DR", "SET"],
        ctx,
        deps,
      );

      expect(sep).toBe("__");
    });

    it("should return _ when scoped register name is a register", () => {
      const deps = createMockDeps({
        isKnownRegister: vi.fn((name) => name === "Motor__CONTROL_REG"),
      });
      const ctx = createContext({ scopedRegName: "Motor__CONTROL_REG" });

      const sep = MemberSeparatorResolver.getSubsequentSeparator(
        ["CONTROL_REG", "SPEED"],
        ctx,
        deps,
      );

      expect(sep).toBe("__");
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
        ctx,
        deps,
      );

      expect(sep).toBe("__");
    });
  });

  describe("priority ordering", () => {
    it("should prioritize C++ access over struct param", () => {
      const deps = createMockDeps({
        rootMemberSeparator: vi.fn(() => "->"),
      });
      const ctx = createContext({
        isCppAccess: true,
        holding: STRUCT_PARAM,
      });

      const sep = MemberSeparatorResolver.getFirstSeparator(["obj"], ctx, deps);

      expect(sep).toBe("::");
      expect(deps.rootMemberSeparator).not.toHaveBeenCalled();
    });

    it("should prioritize struct param over cross-scope", () => {
      const deps = createMockDeps({
        rootMemberSeparator: vi.fn(() => "->"),
      });
      const ctx = createContext({
        holding: STRUCT_PARAM,
        isCrossScope: true,
      });

      const sep = MemberSeparatorResolver.getFirstSeparator(
        ["point"],
        ctx,
        deps,
      );

      expect(sep).toBe("->");
    });
  });
});
