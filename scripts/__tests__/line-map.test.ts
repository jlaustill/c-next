/**
 * #1518: the line mapper the throw-citation fixer stands on.
 *
 * The property that matters is not "maps most lines" — it is that a line it
 * cannot place with certainty is ABSENT rather than guessed. A citation moved
 * to a plausible wrong line is worse than one left visibly stale, because the
 * gate goes green on it.
 */

import LineMap from "../diagnostics/LineMap";

const lines = (text: string): string[] => text.split("\n");

describe("LineMap.build", () => {
  it("maps every line when nothing changed", () => {
    const src = lines("import a\n\nfunction f() {\n  return 1;\n}");
    const map = LineMap.build(src, src);

    expect([...map.entries()]).toEqual([
      [1, 1],
      [2, 2],
      [3, 3],
      [4, 4],
      [5, 5],
    ]);
  });

  it("shifts everything after an insertion", () => {
    const before = lines(
      "import a\nimport b\nfunction f() {\n  throw new Error('x');\n}",
    );
    const after = lines(
      "import a\nimport NEW\nimport b\nfunction f() {\n  throw new Error('x');\n}",
    );
    const map = LineMap.build(before, after);

    expect(map.get(1)).toBe(1);
    expect(map.get(2)).toBe(3);
    expect(map.get(4)).toBe(5);
    expect(map.get(5)).toBe(6);
  });

  it("shifts everything after a deletion", () => {
    const before = lines("a\nDELETED\nb\nc\nd");
    const after = lines("a\nb\nc\nd");
    const map = LineMap.build(before, after);

    expect(map.get(1)).toBe(1);
    expect(map.get(3)).toBe(2);
    expect(map.get(5)).toBe(4);
    expect(map.has(2)).toBe(false);
  });

  it("handles an insertion and a deletion in different places", () => {
    const before = lines("a\nGONE\nb\nc\nd\ne");
    const after = lines("a\nb\nc\nADDED\nd\ne");
    const map = LineMap.build(before, after);

    expect(map.get(3)).toBe(2);
    expect(map.get(4)).toBe(3);
    expect(map.get(5)).toBe(5);
    expect(map.get(6)).toBe(6);
  });

  // The contract. A repeated line anchors nothing, so a region built only from
  // repeated lines yields no mapping rather than a confident wrong one.
  it("declines to map a region with no unique line", () => {
    const before = lines("head\n  }\n  }\n  }\ntail");
    const after = lines("head\n  }\n  }\n  }\n  }\ntail");
    const map = LineMap.build(before, after);

    expect(map.get(1)).toBe(1);
    expect(map.get(5)).toBe(6);
    for (const ambiguous of [2, 3, 4]) {
      expect(map.has(ambiguous)).toBe(false);
    }
  });

  it("does not let a moved line drag its neighbors", () => {
    const before = lines("alpha\nbeta\ngamma\ndelta\nepsilon");
    const after = lines("beta\nalpha\ngamma\ndelta\nepsilon");
    const map = LineMap.build(before, after);

    // gamma/delta/epsilon are unmoved and must map to themselves; whichever of
    // alpha/beta the chain drops must not pull them.
    expect(map.get(3)).toBe(3);
    expect(map.get(4)).toBe(4);
    expect(map.get(5)).toBe(5);
  });

  it("returns nothing for empty input", () => {
    expect(LineMap.build([], []).size).toBe(0);
    expect(LineMap.build(["a"], []).size).toBe(0);
  });
});
