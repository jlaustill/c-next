/**
 * Issue #1357: the gate on scope-denoting `fromParts` sites must be able to fail.
 */

import { describe, it, expect } from "vitest";
import prettier from "prettier";

import ScopeJoinSites from "../scope-joins/ScopeJoinSites";

describe("ScopeJoinSites", () => {
  describe("firstElements", () => {
    it("reads the first element of a single-line call", () => {
      expect(
        ScopeJoinSites.firstElements(
          "const x = QualifiedCName.fromParts([scopeName, name]);",
        ),
      ).toEqual(["scopeName"]);
    });

    it("reads a call that spans lines", () => {
      // The shape Prettier produces for anything past ~80 columns, which is
      // most of these. A line-oriented regex sees only `fromParts([`.
      expect(
        ScopeJoinSites.firstElements(
          "QualifiedCName.fromParts([\n  frame.scopeName,\n  memberName,\n]);",
        ),
      ).toEqual(["frame.scopeName"]);
    });

    it("does not stop at a comma inside a nested call", () => {
      expect(
        ScopeJoinSites.firstElements(
          "QualifiedCName.fromParts([ScopeUtils.qualifyInScope(parts[0], scope), leaf]);",
        ),
      ).toEqual(["ScopeUtils.qualifyInScope(parts[0], scope)"]);
    });

    it("finds every call in a file", () => {
      expect(
        ScopeJoinSites.firstElements(
          "QualifiedCName.fromParts([a, b]); QualifiedCName.fromParts([scopeName, c]);",
        ),
      ).toEqual(["a", "scopeName"]);
    });
  });

  describe("isScopeDenoting", () => {
    it.each([
      ["scopeName", true],
      ["currentScope", true],
      ["frame.scopeName", true],
      ["scope.name", true],
      ["callerScope", true],
    ])("flags %s", (element, expected) => {
      expect(ScopeJoinSites.isScopeDenoting(element)).toBe(expected);
    });

    it.each([
      ["cName", false],
      ["regName", false],
      ["...identifiers", false],
      ["parts[0]", false],
      ["switchEnumType", false],
    ])("does not flag %s", (element, expected) => {
      expect(ScopeJoinSites.isScopeDenoting(element)).toBe(expected);
    });

    it("does not flag a scope routed through ScopeUtils", () => {
      // Negative control. Threading the reference is the FIX, so a call that
      // does it must not be counted as residue -- otherwise the gate would
      // punish the very change it exists to encourage, and the baseline could
      // never reach zero.
      expect(
        ScopeJoinSites.isScopeDenoting(
          "ScopeUtils.qualifyInScope(parts[0], declaringScope)",
        ),
      ).toBe(false);
    });
  });

  describe("check", () => {
    const doc = ScopeJoinSites.render([
      { file: "src/a.ts", count: 2 },
      { file: "src/b.ts", count: 1 },
    ]);

    it("passes when the population is unchanged", () => {
      expect(
        ScopeJoinSites.check(doc, [
          { file: "src/a.ts", count: 2 },
          { file: "src/b.ts", count: 1 },
        ]).ok,
      ).toBe(true);
    });

    it("fails when a file gains a site", () => {
      const outcome = ScopeJoinSites.check(doc, [
        { file: "src/a.ts", count: 3 },
        { file: "src/b.ts", count: 1 },
      ]);

      expect(outcome.ok).toBe(false);
      expect(outcome.errors[0]).toContain("grew from 2 to 3");
    });

    it("fails when a file that had none gains one", () => {
      const outcome = ScopeJoinSites.check(doc, [
        { file: "src/a.ts", count: 2 },
        { file: "src/b.ts", count: 1 },
        { file: "src/c.ts", count: 1 },
      ]);

      expect(outcome.ok).toBe(false);
      expect(outcome.errors[0]).toContain("src/c.ts");
    });

    it("fails as stale when sites are removed, so a win gets recorded", () => {
      const outcome = ScopeJoinSites.check(doc, [
        { file: "src/a.ts", count: 2 },
      ]);

      expect(outcome.ok).toBe(false);
      expect(outcome.errors[0]).toContain("down from 1 to 0");
    });

    it("reads a Prettier-formatted document", async () => {
      // Regression: the committed document is Prettier-formatted, which pads
      // table cells to a common width. A parser requiring single spaces failed
      // against the very file the generator had just written, so the gate was
      // red on its own output and would have been "fixed" by deleting it.
      const formatted = await prettier.format(doc, { parser: "markdown" });

      expect(formatted).not.toBe(doc);
      expect(
        ScopeJoinSites.check(formatted, [
          { file: "src/a.ts", count: 2 },
          { file: "src/b.ts", count: 1 },
        ]).ok,
      ).toBe(true);
    });
  });
});
