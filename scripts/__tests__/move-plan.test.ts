import { existsSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import MOVES from "../move-modules/MOVES";
import MovePlan from "../move-modules/MovePlan";

const rootDir = join(__dirname, "..", "..");

const move = (from: string, to: string) => ({ from, to, because: "test" });

describe("MovePlan (#1653, #1826 review)", () => {
  it("skips the first entry of a cycle once the file is back where it started", () => {
    const moves = [
      move("src/a/T.ts", "src/b/T.ts"),
      move("src/b/T.ts", "src/a/T.ts"),
    ];
    const present = new Set(["src/a/T.ts"]);

    expect([...MovePlan.superseded(moves)]).toEqual([0]);
    expect(MovePlan.pending(moves, (p) => present.has(p))).toEqual([]);
    expect([...MovePlan.stalePaths(moves)]).toEqual(["src/b/T.ts"]);
  });

  it("treats every step of a chain as stale", () => {
    const moves = [
      move("src/a/T.ts", "src/b/T.ts"),
      move("src/b/T.ts", "src/c/T.ts"),
    ];

    expect([...MovePlan.superseded(moves)]).toEqual([0]);
    expect(MovePlan.pending(moves, (p) => p === "src/c/T.ts")).toEqual([]);
    expect([...MovePlan.stalePaths(moves)].sort()).toEqual([
      "src/a/T.ts",
      "src/b/T.ts",
    ]);
  });

  it("still reports a move nobody has performed", () => {
    // Negative control: supersession must not hide real work.
    const moves = [move("src/a/T.ts", "src/b/T.ts")];
    expect(MovePlan.pending(moves, (p) => p === "src/a/T.ts")).toEqual(moves);
  });

  it("the committed manifest has nothing left to move", () => {
    // What would have caught #1653's cycle: `--apply` on a committed tree
    // must be a no-op, or the next card that runs it reverts someone's move.
    const pending = MovePlan.pending(MOVES, (path) =>
      existsSync(join(rootDir, path)),
    ).map((m) => `${m.from} -> ${m.to}`);
    expect(pending).toEqual([]);
  });
});
