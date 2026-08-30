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
      expect(ScopeJoinSites.sites(new Map([["src/a.ts", guarded]]))).toEqual([
        { file: "src/a.ts", element: "parts[0]", count: 1 },
      ]);
    });

    it("does not count the same element with no guard", () => {
      expect(
        ScopeJoinSites.sites(
          new Map([
            ["src/a.ts", "QualifiedCName.fromParts([parts[0], parts[1]]);"],
          ]),
        ),
      ).toEqual([]);
    });

    it("counts a guarded call that follows a complete nested block", () => {
      // The backward scan has to step over a closed sibling block to find the
      // guard's own brace. If it stopped at the inner `{` the window would miss
      // `isKnownScope` and the site would go UNCOUNTED -- the false negative
      // that left six sites out of the baseline before #1385.
      const nested = `
        function f() {
          if (CodeGenState.isKnownScope(parts[0])) {
            if (other) { helper(); }
            return QualifiedCName.fromParts([parts[0], parts[1]]);
          }
        }`;

      expect(ScopeJoinSites.sites(new Map([["src/a.ts", nested]]))).toEqual([
        { file: "src/a.ts", element: "parts[0]", count: 1 },
      ]);
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

      expect(ScopeJoinSites.sites(new Map([["src/a.ts", elsewhere]]))).toEqual(
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

  describe("sites", () => {
    it("counts only the scope-denoting sites in each file", () => {
      const rows = ScopeJoinSites.sites(
        new Map([
          [
            "src/b.ts",
            "fromParts is not the call; QualifiedCName.fromParts([scopeName, x]); QualifiedCName.fromParts([cName, y]);",
          ],
        ]),
      );

      expect(rows).toEqual([
        { file: "src/b.ts", element: "scopeName", count: 1 },
      ]);
    });

    it("omits files with no scope-denoting site", () => {
      expect(
        ScopeJoinSites.sites(
          new Map([["src/clean.ts", "QualifiedCName.fromParts([cName, x]);"]]),
        ),
      ).toEqual([]);
    });

    it("sorts by path so the committed document has a stable order", () => {
      // Without this the generated table would reorder on a filesystem whose
      // walk order differs, and every run would produce a spurious diff.
      const call = "QualifiedCName.fromParts([scopeName, x]);";
      const rows = ScopeJoinSites.sites(
        new Map([
          ["src/z.ts", call],
          ["src/a.ts", call],
          ["src/m.ts", call],
        ]),
      );

      expect(rows.map((row) => row.file)).toEqual([
        "src/a.ts",
        "src/m.ts",
        "src/z.ts",
      ]);
    });

    it("collapses identical call shapes in one file and counts them", () => {
      const call = "QualifiedCName.fromParts([scopeName, x]);";
      const sites = ScopeJoinSites.sites(new Map([["src/a.ts", call + call]]));

      expect(sites).toEqual([
        { file: "src/a.ts", element: "scopeName", count: 2 },
      ]);
    });

    it("keeps distinct shapes in one file apart", () => {
      const sites = ScopeJoinSites.sites(
        new Map([
          [
            "src/a.ts",
            "QualifiedCName.fromParts([scopeName, x]); QualifiedCName.fromParts([scopePath, y]);",
          ],
        ]),
      );

      expect(sites.map((row) => row.element)).toEqual([
        "scopeName",
        "scopePath",
      ]);
    });
  });

  describe("check", () => {
    // The mechanism, not today's population: a real file would redden these
    // tests the day its site is closed, which is not what they are about.
    const verdicts = [
      {
        file: "src/a.ts",
        element: "scopeName",
        kind: "path" as const,
        pairedWith: null,
        movesWith: null,
        why: "test fixture",
      },
      {
        file: "src/b.ts",
        element: "scopeName",
        kind: "leaf-keyed" as const,
        pairedWith: "someMap",
        movesWith: "#9999",
        why: "test fixture",
      },
    ];
    const population = [
      { file: "src/a.ts", element: "scopeName", count: 2 },
      { file: "src/b.ts", element: "scopeName", count: 1 },
    ];
    const doc = ScopeJoinSites.render(population, verdicts);

    it("passes when the population is unchanged", () => {
      expect(ScopeJoinSites.check(doc, population, verdicts).ok).toBe(true);
    });

    it("fails when a call shape gains an occurrence", () => {
      const outcome = ScopeJoinSites.check(
        doc,
        [
          { file: "src/a.ts", element: "scopeName", count: 3 },
          { file: "src/b.ts", element: "scopeName", count: 1 },
        ],
        verdicts,
      );

      expect(outcome.ok).toBe(false);
      expect(outcome.errors[0]).toContain("grew from 2 to 3");
    });

    it("fails when a file that had none gains one", () => {
      const outcome = ScopeJoinSites.check(
        doc,
        [...population, { file: "src/c.ts", element: "scopeName", count: 1 }],
        [
          ...verdicts,
          {
            file: "src/c.ts",
            element: "scopeName",
            kind: "path" as const,
            pairedWith: null,
            movesWith: null,
            why: "test fixture",
          },
        ],
      );

      expect(outcome.ok).toBe(false);
      expect(outcome.errors[0]).toContain("src/c.ts");
    });

    it("fails as stale when sites are removed, so a win gets recorded", () => {
      const outcome = ScopeJoinSites.check(doc, [population[0]], [verdicts[0]]);

      expect(outcome.ok).toBe(false);
      expect(outcome.errors[0]).toContain("down from 1 to 0");
    });

    it("fails on a call shape nobody has adjudicated", () => {
      // The point of the table. A new shape must be judged before it lands,
      // rather than joining an unlabeled population the next reader has to
      // re-derive -- which is how both #1295 claims went unchecked.
      const outcome = ScopeJoinSites.check(doc, population, [verdicts[0]]);

      expect(outcome.ok).toBe(false);
      expect(outcome.errors.join("\n")).toContain("has no adjudication");
    });

    it("marks an unadjudicated site in the document it writes", () => {
      // The writer-facing half of the gate. `check` refuses an unadjudicated
      // site, but the document `write` emits is what the contributor reads
      // first, so a render that silently omitted or blank-filled the row would
      // hide the very thing they have to act on.
      expect(ScopeJoinSites.render(population, [verdicts[0]])).toContain(
        "**UNADJUDICATED**",
      );
    });

    it("stays red on an unadjudicated site after the document is regenerated", () => {
      // The one path that silently defeats this gate. Every other generated-doc
      // gate in this repo is greened by running its regenerate command, so a
      // contributor who hits "has no adjudication" reaches for `npm run
      // scope-joins` reflexively. It must not work: the judgement lives in
      // `ADJUDICATIONS`, which is source code, and regenerating only rewrites
      // the row that reports the gap.
      const regenerated = ScopeJoinSites.render(population, [verdicts[0]]);
      const outcome = ScopeJoinSites.check(regenerated, population, [
        verdicts[0],
      ]);

      expect(outcome.ok).toBe(false);
      expect(outcome.errors.join("\n")).toContain("has no adjudication");
    });

    it("fails on a judgement that outlived its code", () => {
      // Without this, a fixed site keeps its verdict forever and the checklist
      // rots into the prose promise it replaced.
      const outcome = ScopeJoinSites.check(doc, population, [
        ...verdicts,
        {
          file: "src/gone.ts",
          element: "scopeName",
          kind: "path" as const,
          pairedWith: null,
          movesWith: null,
          why: "test fixture",
        },
      ]);

      expect(outcome.ok).toBe(false);
      expect(outcome.errors.join("\n")).toContain("matches no site");
    });

    it("renders the kind and the owning card for every row", () => {
      expect(doc).toContain("| `src/a.ts` | `scopeName` | 2 | path | -- |");
      expect(doc).toContain(
        "| `src/b.ts` | `scopeName` | 1 | leaf-keyed | #9999 |",
      );
      expect(doc).toContain("`someMap`");
    });

    it("renders the kind bullets in the declared precedence order", () => {
      // Finding 5 of the #1395 review: the `TKind` union and this preamble each
      // stated the precedence, and had drifted into stating OPPOSITE orders --
      // on a rule nothing computes, so only a reader would ever notice. Both now
      // derive from `KIND_SECTIONS`; this pins that they still travel together,
      // since making them agree once is not the same as making them unable to
      // disagree.
      const order = ["via-scope-utils", "leaf-keyed", "path"];
      const positions = order.map((kind) => doc.indexOf(`- **${kind}**`));

      expect(positions.every((at) => at >= 0)).toBe(true);
      expect(positions).toEqual([...positions].sort((a, b) => a - b));
    });

    it("says so when nothing is waiting on another card", () => {
      const clean = ScopeJoinSites.render([population[0]], [verdicts[0]]);

      expect(clean).toContain("Nothing. Every remaining site is adjudicated");
      expect(clean).not.toContain("| Site | Paired with |");
    });

    it("reads a Prettier-formatted document", async () => {
      // Regression: the committed document is Prettier-formatted, which pads
      // table cells to a common width. A parser requiring single spaces failed
      // against the very file the generator had just written, so the gate was
      // red on its own output and would have been "fixed" by deleting it.
      const formatted = await prettier.format(doc, { parser: "markdown" });

      expect(formatted).not.toBe(doc);
      expect(ScopeJoinSites.check(formatted, population, verdicts).ok).toBe(
        true,
      );
    });
  });
});
