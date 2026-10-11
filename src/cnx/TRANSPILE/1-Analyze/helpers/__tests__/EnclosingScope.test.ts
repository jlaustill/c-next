import { describe, it, expect } from "vitest";

import EnclosingScope from "../EnclosingScope";
import ScopeUtils from "../../../../utils/ScopeUtils";

/**
 * #1357. These cover nesting the grammar does not express and never will:
 * `scopeMember` admits no `scopeDeclaration` (ADR-016, permanently), so no `.cnx`
 * fixture can reach depth two and the integration corpus cannot tell a
 * chain-walking encoder from a leaf-only one. The depth is still reachable through
 * `SymbolRegistry`, which takes a dotted path -- which is why these assertions can
 * exist here at all, and why they cannot be fixtures.
 */
describe("EnclosingScope", () => {
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
});
