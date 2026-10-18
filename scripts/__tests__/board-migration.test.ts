import { describe, expect, it } from "vitest";

import BoardMigration from "../board/BoardMigration";
import type IBacklogMove from "../types/IBacklogMove";
import type IBoardItem from "../types/IBoardItem";

/** A card; `key` is both the content id and, with a board prefix, the item id. */
function on(
  board: string,
  key: string,
  status: string | undefined,
  repository = "smeltworks/cnx",
  number = Number(key.replace(/\D/g, "")) || 1,
): IBoardItem {
  return {
    itemId: `${board}-${key}`,
    contentId: key,
    status,
    repository,
    number,
  };
}

/** Applies planned moves to a list of item ids, the way the board would. */
function apply(itemIds: string[], moves: IBacklogMove[]): string[] {
  const order = [...itemIds];
  for (const move of moves) {
    order.splice(order.indexOf(move.itemId), 1);
    order.splice(order.indexOf(move.afterId) + 1, 0, move.itemId);
  }
  return order;
}

describe("BoardMigration.missing", () => {
  it("returns the source cards the target lacks, in source order", () => {
    const source = [
      on("s", "I3", "Done"),
      on("s", "I1", "WIP"),
      on("s", "I2", "Backlog"),
    ];
    const target = [on("t", "I1", "WIP")];
    expect(
      BoardMigration.missing(source, target).map((c) => c.contentId),
    ).toEqual(["I3", "I2"]);
  });

  it("treats one issue number in two repositories as two cards", () => {
    // Numbers repeat across repositories (cnx#5, vscode-cnx#5). Keyed by
    // number, the second would read as already migrated and never arrive.
    const source = [
      on("s", "I_CNX_5", "Backlog", "smeltworks/cnx", 5),
      on("s", "I_VSC_5", "Grooming", "smeltworks/vscode-cnx", 5),
    ];
    const target = [on("t", "I_CNX_5", "Backlog", "smeltworks/cnx", 5)];
    expect(
      BoardMigration.missing(source, target).map((c) => c.contentId),
    ).toEqual(["I_VSC_5"]);
  });

  it("returns nothing once every source card is on the target", () => {
    const source = [on("s", "I1", "Done")];
    expect(BoardMigration.missing(source, [on("t", "I1", "Done")])).toEqual([]);
  });
});

describe("BoardMigration.statusDrift", () => {
  it("reports a card whose target Status differs, as target item and both names", () => {
    const drift = BoardMigration.statusDrift(
      [on("s", "I1", "Done")],
      [on("t", "I1", undefined)],
    );
    expect(drift).toEqual([
      { item: on("t", "I1", undefined), from: undefined, to: "Done" },
    ]);
  });

  it("leaves a card whose Status already matches", () => {
    expect(
      BoardMigration.statusDrift(
        [on("s", "I1", "WIP")],
        [on("t", "I1", "WIP")],
      ),
    ).toEqual([]);
  });

  it("has nothing to copy from a source card with no Status", () => {
    expect(
      BoardMigration.statusDrift(
        [on("s", "I1", undefined)],
        [on("t", "I1", "Grooming")],
      ),
    ).toEqual([]);
  });

  it("ignores cards only the target holds", () => {
    expect(BoardMigration.statusDrift([], [on("t", "I9", "Grooming")])).toEqual(
      [],
    );
  });
});

describe("BoardMigration.orderMoves", () => {
  const source = [
    on("s", "I1", "Done"),
    on("s", "I2", "Done"),
    on("s", "I3", "Done"),
  ];

  it("plans nothing when the target already holds the source order", () => {
    const target = [
      on("t", "I1", "Done"),
      on("t", "I2", "Done"),
      on("t", "I3", "Done"),
    ];
    expect(BoardMigration.orderMoves(source, target)).toEqual([]);
  });

  it("puts a reversed target back in source order", () => {
    const target = [
      on("t", "I3", "Done"),
      on("t", "I2", "Done"),
      on("t", "I1", "Done"),
    ];
    const moves = BoardMigration.orderMoves(source, target);
    expect(moves.length).toBeGreaterThan(0);
    expect(
      apply(
        target.map((c) => c.itemId),
        moves,
      ),
    ).toEqual(["t-I1", "t-I2", "t-I3"]);
  });

  it("orders the copied cards around cards only the target holds", () => {
    const target = [
      on("t", "I2", "Done"),
      on("t", "X1", "Grooming"),
      on("t", "I1", "Done"),
      on("t", "I3", "Done"),
    ];
    const order = apply(
      target.map((c) => c.itemId),
      BoardMigration.orderMoves(source, target),
    );
    const copied = order.filter((id) => id !== "t-X1");
    expect(copied).toEqual(["t-I1", "t-I2", "t-I3"]);
  });
});

describe("BoardMigration.diff", () => {
  it("is empty when the target matches the source", () => {
    const source = [on("s", "I1", "WIP"), on("s", "I2", "Done")];
    const target = [on("t", "I1", "WIP"), on("t", "I2", "Done")];
    expect(BoardMigration.diff(source, target)).toEqual({
      missing: [],
      statusDrift: [],
      outOfOrder: 0,
    });
  });

  it("reports each kind of difference", () => {
    const source = [
      on("s", "I1", "WIP"),
      on("s", "I2", "Done"),
      on("s", "I3", "Backlog"),
    ];
    const target = [on("t", "I2", "Grooming"), on("t", "I1", "WIP")];
    const diff = BoardMigration.diff(source, target);
    expect(diff.missing.map((c) => c.contentId)).toEqual(["I3"]);
    expect(diff.statusDrift.map((d) => d.item.contentId)).toEqual(["I2"]);
    expect(diff.outOfOrder).toBeGreaterThan(0);
  });
});
