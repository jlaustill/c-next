import { describe, it, expect } from "vitest";
import ScopeUtils from "../ScopeUtils";
import type IScopeSymbol from "../../transpiler/types/symbols/IScopeSymbol";

describe("IScopeSymbol", () => {
  describe("createGlobalScope", () => {
    it("creates global scope with self-reference parent", () => {
      const global = ScopeUtils.createGlobalScope();
      expect(global.kind).toBe("scope");
      expect(global.name).toBe("");
      expect(global.parent).toBe(global); // Self-reference
      expect(global.functions).toEqual([]);
      expect(global.variables).toEqual([]);
    });
  });

  describe("createScope", () => {
    it("creates named scope with parent reference", () => {
      const global = ScopeUtils.createGlobalScope();
      const test = ScopeUtils.createScope("Test", global);
      expect(test.kind).toBe("scope");
      expect(test.name).toBe("Test");
      expect(test.parent).toBe(global);
    });

    it("supports nested scopes", () => {
      const global = ScopeUtils.createGlobalScope();
      const outer = ScopeUtils.createScope("Outer", global);
      const inner = ScopeUtils.createScope("Inner", outer);
      expect(inner.parent).toBe(outer);
      expect(outer.parent).toBe(global);
    });

    it("initializes empty functions and variables arrays", () => {
      const global = ScopeUtils.createGlobalScope();
      const scope = ScopeUtils.createScope("Test", global);
      expect(scope.functions).toEqual([]);
      expect(scope.variables).toEqual([]);
    });
  });

  describe("isGlobalScope", () => {
    it("returns true for global scope", () => {
      const global = ScopeUtils.createGlobalScope();
      expect(ScopeUtils.isGlobalScope(global)).toBe(true);
    });

    it("returns false for named scope", () => {
      const global = ScopeUtils.createGlobalScope();
      const scope = ScopeUtils.createScope("Test", global);
      expect(ScopeUtils.isGlobalScope(scope)).toBe(false);
    });
  });

  describe("getDefaultVisibility", () => {
    it("returns 'public' for functions (API surface)", () => {
      expect(ScopeUtils.getDefaultVisibility(true)).toBe("public");
    });

    it("returns 'private' for non-functions (internal state)", () => {
      expect(ScopeUtils.getDefaultVisibility(false)).toBe("private");
    });
  });

  describe("getScopePath cycle detection", () => {
    it("throws instead of looping when a scope is its own ancestor", () => {
      // A named scope that is its own parent never satisfies isGlobalScope, so
      // the walk cannot terminate. This shape is unreachable through the
      // factories but writable by hand, and it silently hung the whole test
      // suite for 30+ minutes once getScopePath started running for every
      // symbol added to the SymbolTable.
      const cyclic = ScopeUtils.createScope(
        "Loop",
        ScopeUtils.createGlobalScope(),
      );
      (cyclic as { parent: unknown }).parent = cyclic;

      expect(() => ScopeUtils.getScopePath(cyclic)).toThrow(
        /is its own ancestor/,
      );
    });

    it("throws a named error when the chain ends instead of reaching global", () => {
      // The other non-terminating shape. Hand-built mocks reach it via
      // `as unknown as IScopeSymbol`, and the walk runs for every symbol added
      // to the SymbolTable, so a raw TypeError here is very hard to trace back.
      const orphan = { name: "Motor" } as unknown as IScopeSymbol;

      expect(() => ScopeUtils.getScopePath(orphan)).toThrow(/has no parent/);
      // Specifically not a TypeError from dereferencing undefined.
      expect(() => ScopeUtils.getScopePath(orphan)).not.toThrow(TypeError);
    });

    it("throws on a longer parent cycle", () => {
      const global = ScopeUtils.createGlobalScope();
      const outer = ScopeUtils.createScope("Outer", global);
      const inner = ScopeUtils.createScope("Inner", outer);
      (outer as { parent: unknown }).parent = inner;

      expect(() => ScopeUtils.getScopePath(inner)).toThrow(
        /never reaches the global scope/,
      );
    });
  });

  describe("getTranspiledCName", () => {
    it("returns the bare name for a global symbol", () => {
      const global = ScopeUtils.createGlobalScope();
      expect(
        ScopeUtils.getTranspiledCName({ name: "main", scope: global }),
      ).toBe("main");
    });

    it("returns a scope-prefixed name for a scoped symbol", () => {
      const global = ScopeUtils.createGlobalScope();
      const test = ScopeUtils.createScope("Test", global);
      expect(
        ScopeUtils.getTranspiledCName({ name: "fillData", scope: test }),
      ).toBe("Test__fillData");
    });

    it("walks the whole parent chain for a nested scope", () => {
      // Regression guard: reading scope.name alone yields "Inner__process" and
      // drops the outer scope. Two encoders disagreed exactly here, and agreed
      // elsewhere only because the grammar admits no nested scopes today.
      const global = ScopeUtils.createGlobalScope();
      const outer = ScopeUtils.createScope("Outer", global);
      const inner = ScopeUtils.createScope("Inner", outer);
      expect(
        ScopeUtils.getTranspiledCName({ name: "process", scope: inner }),
      ).toBe("Outer__Inner__process");
    });
  });

  describe("identityOf (#1285)", () => {
    it("gives a global symbol its bare name in both namespaces", () => {
      const global = ScopeUtils.createGlobalScope();

      expect(ScopeUtils.identityOf({ name: "counter", scope: global })).toEqual(
        {
          fullyQualifiedCName: "counter",
          cnxScopedName: "counter",
        },
      );
    });

    it("qualifies a scope member in both namespaces", () => {
      const global = ScopeUtils.createGlobalScope();
      const motor = ScopeUtils.createScope("Motor", global);

      expect(ScopeUtils.identityOf({ name: "init", scope: motor })).toEqual({
        fullyQualifiedCName: "Motor__init",
        cnxScopedName: "Motor.init",
      });
    });

    it("walks the whole parent chain at depth 2", () => {
      // The property this whole change exists to establish. Reading `scope.name`
      // alone yields "Inner__tick"/"Inner.tick" and drops the outer scope --
      // which is what the leaf-only encoders did, agreeing with the chain-walking
      // one only because the grammar admits no nested scopes today.
      //
      // Nested scopes are unreachable from .cnx source (grammar/CNext.g4:81-89),
      // so this unit test is the ONLY thing that can hold the property. It must
      // not be deleted as "testing an impossible case".
      const global = ScopeUtils.createGlobalScope();
      const outer = ScopeUtils.createScope("Outer", global);
      const inner = ScopeUtils.createScope("Inner", outer);

      expect(ScopeUtils.identityOf({ name: "tick", scope: inner })).toEqual({
        fullyQualifiedCName: "Outer__Inner__tick",
        cnxScopedName: "Outer.Inner.tick",
      });
    });

    it("gives a nested scope its own identity from its parent chain", () => {
      const global = ScopeUtils.createGlobalScope();
      const outer = ScopeUtils.createScope("Outer", global);
      const inner = ScopeUtils.createScope("Inner", outer);
      const leaf = ScopeUtils.createScope("Leaf", inner);

      // Depth THREE on purpose. At depth two a scope's parent name happens to
      // be the whole chain, so a leaf-only encoder is accidentally right and a
      // depth-two assertion here cannot fail. Verified: mutating the encoder to
      // read `scope.name` alone leaves `inner` correct and breaks only `leaf`.
      expect(leaf.fullyQualifiedCName).toBe("Outer__Inner__Leaf");
      expect(leaf.cnxScopedName).toBe("Outer.Inner.Leaf");
      expect(outer.fullyQualifiedCName).toBe("Outer");
    });

    it("gives the global scope an empty identity", () => {
      // Computed through the encoder after the self-references are patched, not
      // hardcoded -- the global scope must not become the one symbol whose
      // identity was derived a second way.
      const global = ScopeUtils.createGlobalScope();

      expect(global.fullyQualifiedCName).toBe("");
      expect(global.cnxScopedName).toBe("");
    });

    it("keeps the two namespaces distinct but describing the same path", () => {
      // `Outer.Inner.tick` is not derivable from `Outer__Inner__tick` at a call
      // site without knowing which one it already holds, which is why both are
      // stored rather than one being converted into the other on demand.
      //
      // They must still describe the SAME path. This is the cross-check that
      // catches one namespace being computed a different way from the other:
      // under a leaf-only C encoder the names come back as `Inner__tick` and
      // `Outer.Inner.tick`, which disagree about how deep the symbol sits.
      const global = ScopeUtils.createGlobalScope();
      const outer = ScopeUtils.createScope("Outer", global);
      const inner = ScopeUtils.createScope("Inner", outer);
      const identity = ScopeUtils.identityOf({ name: "tick", scope: inner });

      expect(identity.fullyQualifiedCName).not.toBe(identity.cnxScopedName);
      expect(identity.fullyQualifiedCName.split("__")).toHaveLength(
        identity.cnxScopedName.split(".").length,
      );
    });
  });
});
