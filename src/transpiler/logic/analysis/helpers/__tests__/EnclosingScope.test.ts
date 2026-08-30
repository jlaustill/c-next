import { describe, it, expect, beforeEach } from "vitest";

import EnclosingScope from "../EnclosingScope";
import SymbolRegistry from "../../../../state/SymbolRegistry";
import ScopeUtils from "../../../../../utils/ScopeUtils";

/**
 * #1357. These cover the nesting the grammar cannot yet express: `scopeMember`
 * admits no `scopeDeclaration`, so no `.cnx` fixture can reach depth two and the
 * integration corpus cannot tell a chain-walking encoder from a leaf-only one.
 * That is precisely the coincidence this helper exists to stop relying on, so
 * the assertions that prove it live here rather than in a fixture.
 */
describe("EnclosingScope", () => {
  beforeEach(() => {
    SymbolRegistry.reset();
  });

  describe("current", () => {
    it("is null at file scope", () => {
      expect(new EnclosingScope().current()).toBeNull();
    });

    it("reports the open scope at depth one", () => {
      const enclosing = new EnclosingScope();
      enclosing.enter("Motor");

      expect(enclosing.current()?.name).toBe("Motor");
    });

    it("returns to null after the scope closes", () => {
      const enclosing = new EnclosingScope();
      enclosing.enter("Motor");
      enclosing.exit();

      expect(enclosing.current()).toBeNull();
    });

    it("keeps the outer component at depth two", () => {
      const enclosing = new EnclosingScope();
      enclosing.enter("Outer");
      enclosing.enter("Inner");

      const scope = enclosing.current()!;
      expect(scope.name).toBe("Inner");
      expect(ScopeUtils.getScopePath(scope)).toEqual(["Outer", "Inner"]);
    });

    it("qualifies a member with every enclosing component", () => {
      const enclosing = new EnclosingScope();
      enclosing.enter("Outer");
      enclosing.enter("Inner");

      // The leaf-only encoder this replaces produced `Inner__tick`.
      expect(ScopeUtils.qualifyInScope("tick", enclosing.current())).toBe(
        "Outer__Inner__tick",
      );
    });

    it("unwinds to the outer scope when the inner one closes", () => {
      const enclosing = new EnclosingScope();
      enclosing.enter("Outer");
      enclosing.enter("Inner");
      enclosing.exit();

      expect(ScopeUtils.qualifyInScope("tick", enclosing.current())).toBe(
        "Outer__tick",
      );
    });
  });

  describe("isInsideScope", () => {
    it("is false at file scope and true within one", () => {
      const enclosing = new EnclosingScope();
      expect(enclosing.isInsideScope()).toBe(false);

      enclosing.enter("Motor");
      expect(enclosing.isInsideScope()).toBe(true);

      enclosing.exit();
      expect(enclosing.isInsideScope()).toBe(false);
    });
  });

  describe("child", () => {
    it("treats a null parent as file scope", () => {
      expect(
        ScopeUtils.getScopePath(EnclosingScope.child(null, "Motor")),
      ).toEqual(["Motor"]);
    });

    it("treats the global scope as no prefix", () => {
      const child = EnclosingScope.child(
        SymbolRegistry.getGlobalScope(),
        "Motor",
      );

      expect(ScopeUtils.getScopePath(child)).toEqual(["Motor"]);
    });

    it("prefixes the parent's whole chain, not its leaf", () => {
      const outer = EnclosingScope.child(null, "Outer");
      const inner = EnclosingScope.child(outer, "Inner");

      expect(
        ScopeUtils.getScopePath(EnclosingScope.child(inner, "Deep")),
      ).toEqual(["Outer", "Inner", "Deep"]);
    });

    it("returns the same scope object for the same path", () => {
      const first = EnclosingScope.child(null, "Motor");
      const second = EnclosingScope.child(null, "Motor");

      // Repeat-safe: this is how a scope spanned across two files merges (#1333).
      expect(second).toBe(first);
    });

    it("agrees with the stack for the same nesting", () => {
      const enclosing = new EnclosingScope();
      enclosing.enter("Outer");
      enclosing.enter("Inner");

      const viaChild = EnclosingScope.child(
        EnclosingScope.child(null, "Outer"),
        "Inner",
      );

      // One implementation of "descend one named scope": the stack and the
      // per-node collector must not be able to disagree about a path.
      expect(enclosing.current()).toBe(viaChild);
    });
  });
});
