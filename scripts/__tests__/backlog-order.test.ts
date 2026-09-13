import { describe, expect, it } from "vitest";

import BacklogOrder from "../backlog/BacklogOrder";
import type IBacklogCard from "../types/IBacklogCard";
import type IBacklogMove from "../types/IBacklogMove";

/** A column, written top-to-bottom as `[issue, "blocked by text"]`. */
function column(...rows: [number, string][]): IBacklogCard[] {
  return rows.map(([number, blockedBy]) => ({
    number,
    itemId: `item-${number}`,
    blockedBy,
    title: `card ${number}`,
  }));
}

function numbers(cards: IBacklogCard[]): number[] {
  return cards.map((card) => card.number);
}

describe("BacklogOrder.derive", () => {
  it("leaves a column with no blockers exactly as it found it", () => {
    const outcome = BacklogOrder.derive(column([3, ""], [1, ""], [2, ""]));
    expect(numbers(outcome.order)).toEqual([3, 1, 2]);
    expect(outcome.moved).toEqual([]);
    expect(outcome.constraints).toBe(0);
  });

  it("raises a blocker above the card it blocks", () => {
    const outcome = BacklogOrder.derive(column([1, "#2"], [2, ""]));
    expect(numbers(outcome.order)).toEqual([2, 1]);
    expect(numbers(outcome.moved)).toEqual([2, 1]);
    expect(outcome.constraints).toBe(1);
  });

  it("orders a transitive chain, deepest blocker first", () => {
    const outcome = BacklogOrder.derive(column([1, "#2"], [2, "#3"], [3, ""]));
    expect(numbers(outcome.order)).toEqual([3, 2, 1]);
  });

  it.each([
    ["a blocker that is closed or in another column", "#999"],
    ["a card naming itself", "#1"],
    ["prose that cites but does not block", "waiting — see #999"],
  ])("ignores %s", (_label, blockedBy) => {
    const outcome = BacklogOrder.derive(column([1, blockedBy], [2, ""]));
    expect(numbers(outcome.order)).toEqual([1, 2]);
    expect(outcome.constraints).toBe(0);
  });

  it("preserves the relative order of any pair no constraint separates", () => {
    const outcome = BacklogOrder.derive(
      column([10, "#30"], [40, ""], [30, ""], [20, ""]),
    );
    // Only #10 sinking below #30 is forced. #40 rises a slot as a consequence
    // of that, not as a reshuffle: every unconstrained PAIR keeps its order.
    expect(numbers(outcome.order)).toEqual([40, 30, 10, 20]);
    const rank = (issue: number): number =>
      numbers(outcome.order).indexOf(issue);
    expect(rank(30)).toBeLessThan(rank(10));
    expect(rank(40)).toBeLessThan(rank(20));
    expect(rank(40)).toBeLessThan(rank(30));
  });

  it("is stable: among cards free to go next it takes the highest", () => {
    const outcome = BacklogOrder.derive(column([5, ""], [4, ""], [3, "#5"]));
    expect(numbers(outcome.order)).toEqual([5, 4, 3]);
    expect(outcome.moved).toEqual([]);
  });

  it("counts only the edges inside the column", () => {
    const outcome = BacklogOrder.derive(
      column([1, "#2, #999"], [2, "#998"], [3, ""]),
    );
    expect(outcome.constraints).toBe(1);
  });

  it("refuses a cycle and names it rather than ordering arbitrarily", () => {
    expect(() => BacklogOrder.derive(column([1, "#2"], [2, "#1"]))).toThrow(
      /cycle/,
    );
    expect(() => BacklogOrder.derive(column([1, "#2"], [2, "#1"]))).toThrow(
      /#1 is blocked by #2 is blocked by #1/,
    );
  });

  it("refuses a cycle reached through a card that is not in it", () => {
    expect(() =>
      BacklogOrder.derive(column([1, "#2"], [2, "#3"], [3, "#2"])),
    ).toThrow(/cycle/);
  });
});

/** Applies a plan the way the board would, so the plan can be checked by result. */
function replay(current: IBacklogCard[], moves: IBacklogMove[]): number[] {
  const model = [...current];
  for (const move of moves) {
    const card = model.find((entry) => entry.itemId === move.itemId);
    const above = model.find((entry) => entry.itemId === move.afterId);
    if (card === undefined || above === undefined) {
      throw new Error(`plan names an item not in the column: ${move.itemId}`);
    }
    model.splice(model.indexOf(card), 1);
    model.splice(model.indexOf(above) + 1, 0, card);
  }
  return model.map((card) => card.number);
}

describe("BacklogOrder.plan", () => {
  it("plans nothing when the column is already in order", () => {
    const cards = column([3, ""], [1, "#3"], [2, "#1"]);
    const outcome = BacklogOrder.derive(cards);
    expect(outcome.moved).toEqual([]);
    expect(BacklogOrder.plan(cards, outcome.order)).toEqual([]);
  });

  it("names the card and where it must land", () => {
    const cards = column([1, "#2"], [2, ""]);
    const moves = BacklogOrder.plan(cards, BacklogOrder.derive(cards).order);
    // #1 sinks below #2; moving the blocked card is one write, not two.
    expect(moves).toEqual([{ itemId: "item-1", afterId: "item-2", number: 1 }]);
  });

  it.each([
    ["a blocker at the bottom", column([1, "#4"], [2, ""], [3, ""], [4, ""])],
    ["a chain in reverse", column([1, "#2"], [2, "#3"], [3, "#4"], [4, ""])],
    [
      "one card far out of place",
      column([9, "#1, #2, #3"], [1, ""], [2, ""], [3, ""]),
    ],
    ["a column needing no change", column([1, ""], [2, "#1"], [3, "#2"])],
  ])("replays to exactly the derived order: %s", (_label, cards) => {
    const outcome = BacklogOrder.derive(cards);
    const moves = BacklogOrder.plan(cards, outcome.order);
    expect(replay(cards, moves)).toEqual(outcome.order.map((c) => c.number));
  });

  it("costs one write when the misplaced card is at the head", () => {
    const cards = column([9, "#1, #2, #3"], [1, ""], [2, ""], [3, ""]);
    const moves = BacklogOrder.plan(cards, BacklogOrder.derive(cards).order);
    expect(moves.map((move) => move.number)).toEqual([9]);
  });

  it("costs a write per card passed when the misplaced card is mid-column", () => {
    // The plan is NOT a minimum move set, and the cost is asymmetric: a card
    // that must sink from the head is one write, but one sitting between the
    // correct prefix and the rest makes every later card hop over it. Pinned so
    // the difference is a recorded property, not a surprise in a run log --
    // this is the shape that cost 13 writes repairing #1443 on the real board.
    const cards = column([1, ""], [9, "#2, #3, #4"], [2, ""], [3, ""], [4, ""]);
    const moves = BacklogOrder.plan(cards, BacklogOrder.derive(cards).order);
    expect(moves.map((move) => move.number)).toEqual([2, 3, 4]);
  });
});
