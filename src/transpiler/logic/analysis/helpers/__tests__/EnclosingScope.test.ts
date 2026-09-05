import { describe, it, expect, beforeEach } from "vitest";

import EnclosingScope from "../EnclosingScope";
import SymbolRegistry from "../../../../state/SymbolRegistry";
import ScopeUtils from "../../../../../utils/ScopeUtils";

/**
 * #1357. These cover nesting the grammar does not express and never will:
 * `scopeMember` admits no `scopeDeclaration` (ADR-016, permanently), so no `.cnx`
 * fixture can reach depth two and the integration corpus cannot tell a
 * chain-walking encoder from a leaf-only one. The depth is still reachable through
 * `SymbolRegistry`, which takes a dotted path -- which is why these assertions can
 * exist here at all, and why they cannot be fixtures.
 */
describe("EnclosingScope", () => {
  beforeEach(() => {
    SymbolRegistry.reset();
  });

  describe("current", () => {
    it("is the empty path at file scope", () => {
      expect(new EnclosingScope().current()).toBe("");
    });

    it("reports the open scope at depth one", () => {
      const enclosing = new EnclosingScope();
      enclosing.enter("Motor");

      expect(enclosing.current()).toBe("Motor");
    });

    it("returns to the empty path after the scope closes", () => {
      const enclosing = new EnclosingScope();
      enclosing.enter("Motor");
      enclosing.exit();

      expect(enclosing.current()).toBe("");
    });

    it("keeps the outer component at depth two", () => {
      const enclosing = new EnclosingScope();
      enclosing.enter("Outer");
      enclosing.enter("Inner");

      expect(enclosing.current()).toBe("Outer.Inner");
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
    it("treats the empty parent path as file scope", () => {
      expect(EnclosingScope.child("", "Motor")).toBe("Motor");
    });

    it("prefixes the parent's whole chain, not its leaf", () => {
      const outer = EnclosingScope.child("", "Outer");
      const inner = EnclosingScope.child(outer, "Inner");

      expect(EnclosingScope.child(inner, "Deep")).toBe("Outer.Inner.Deep");
    });

    it("names the scope it descended into", () => {
      // #1298: this used to assert the same scope OBJECT came back twice, which
      // was a real claim about `getOrCreateScope` caching. Asserting that two
      // calls to a now-pure function agree would not be -- that holds for every
      // possible body, `return ""` included (#1298 review). Assert the value.
      expect(EnclosingScope.child("", "Motor")).toBe("Motor");
      expect(EnclosingScope.child("Outer", "Inner")).toBe("Outer.Inner");
    });

    it("agrees with the stack for the same nesting", () => {
      const enclosing = new EnclosingScope();
      enclosing.enter("Outer");
      enclosing.enter("Inner");

      const viaChild = EnclosingScope.child(
        EnclosingScope.child("", "Outer"),
        "Inner",
      );

      // One implementation of "descend one named scope": the stack and the
      // per-node collector must not be able to disagree about a path.
      expect(enclosing.current()).toBe(viaChild);
    });
  });
});
