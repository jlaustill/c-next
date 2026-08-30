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

    it("ends the element at the closing bracket of a single-element call", () => {
      // `fromParts([...parts.slice(1)])` is a real shape in the codebase: one
      // element, no trailing comma, so the `]` is what terminates it. Every
      // other case here is comma-terminated, which left this path unexercised.
      expect(
        ScopeJoinSites.firstElements(
          "QualifiedCName.fromParts([...parts.slice(1)]);",
        ),
      ).toEqual(["...parts.slice(1)"]);
    });

    it("finds every call in a file", () => {
      expect(
        ScopeJoinSites.firstElements(
          "QualifiedCName.fromParts([a, b]); QualifiedCName.fromParts([scopeName, c]);",
        ),
      ).toEqual(["a", "scopeName"]);
    });
  });

  describe("comment blindness (#1385 review)", () => {
    it("does not count a call that appears in a block comment", () => {
      // These calls are what the JSDoc in this repo is ABOUT, so the text the
      // scan looks for appears in prose constantly. Counting a sentence creates
      // a baseline row for a file with no such site, and the only way to green
      // that is to record the phantom permanently.
      expect(
        ScopeJoinSites.firstElements(
          "/** The drop-in for `QualifiedCName.fromParts([scopeName, name])`. */",
        ),
      ).toEqual([]);
    });

    it("does not count a call that appears in a line comment", () => {
      expect(
        ScopeJoinSites.firstElements(
          "// was QualifiedCName.fromParts([scopeName, x]);",
        ),
      ).toEqual([]);
    });

    it("still counts the real call on a line that also has a comment", () => {
      // Negative control: stripping comments must not swallow code beside them.
      expect(
        ScopeJoinSites.firstElements(
          "const n = QualifiedCName.fromParts([scopeName, x]); // trailing note",
        ),
      ).toEqual(["scopeName"]);
    });
  });

  describe("guard-proven elements (#1385 review)", () => {
    // The document's criterion is "passes a scope's NAME as the first element".
    // A name heuristic cannot see `parts[0]`; the predicate above it can.
    const guarded = `
      function f() {
        if (CodeGenState.isKnownScope(parts[0])) {
          return QualifiedCName.fromParts([parts[0], parts[1]]);
        }
      }`;

    it("counts an element the enclosing block proves is a scope", () => {
      expect(ScopeJoinSites.count(new Map([["src/a.ts", guarded]]))).toEqual([
        { file: "src/a.ts", count: 1 },
      ]);
    });

    it("does not count the same element with no guard", () => {
      expect(
        ScopeJoinSites.count(
          new Map([
            ["src/a.ts", "QualifiedCName.fromParts([parts[0], parts[1]]);"],
          ]),
        ),
      ).toEqual([]);
    });

    it("does not count a guard that sits in a different block", () => {
      // The false positive a file-wide search produces: three of nine on a naive
      // pass, including two `ctx.result` calls guarded by `knownRegisters.has`
      // while an unrelated function in the same file calls isKnownScope on it.
      const elsewhere = `
        function other() {
          if (CodeGenState.isKnownScope(ctx.result)) { return 1; }
        }
        function f() {
          if (knownRegisters.has(ctx.result)) {
            return QualifiedCName.fromParts([ctx.result, memberName]);
          }
        }`;

      expect(ScopeJoinSites.count(new Map([["src/a.ts", elsewhere]]))).toEqual(
        [],
      );
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

  describe("count", () => {
    it("counts only the scope-denoting sites in each file", () => {
      const counts = ScopeJoinSites.count(
        new Map([
          [
            "src/b.ts",
            "fromParts is not the call; QualifiedCName.fromParts([scopeName, x]); QualifiedCName.fromParts([cName, y]);",
          ],
        ]),
      );

      expect(counts).toEqual([{ file: "src/b.ts", count: 1 }]);
    });

    it("omits files with no scope-denoting site", () => {
      expect(
        ScopeJoinSites.count(
          new Map([["src/clean.ts", "QualifiedCName.fromParts([cName, x]);"]]),
        ),
      ).toEqual([]);
    });

    it("sorts by path so the committed document has a stable order", () => {
      // Without this the generated table would reorder on a filesystem whose
      // walk order differs, and every run would produce a spurious diff.
      const call = "QualifiedCName.fromParts([scopeName, x]);";
      const counts = ScopeJoinSites.count(
        new Map([
          ["src/z.ts", call],
          ["src/a.ts", call],
          ["src/m.ts", call],
        ]),
      );

      expect(counts.map((row) => row.file)).toEqual([
        "src/a.ts",
        "src/m.ts",
        "src/z.ts",
      ]);
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
