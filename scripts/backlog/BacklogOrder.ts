import type IBacklogCard from "../types/IBacklogCard";
import type IBacklogMove from "../types/IBacklogMove";
import type IBacklogOrderOutcome from "../types/IBacklogOrderOutcome";

import BlockedByField from "./BlockedByField";

/**
 * Orders a board column so that a card sits below everything blocking it.
 *
 * The order is DERIVED from `Blocked by`, never recorded -- the same shape as
 * `release:milestones` and the coverage matrix. Nothing stores "card X goes
 * above card Y"; the field is the single source and this recomputes from it.
 *
 * Two properties make it safe to run unattended:
 *
 *   - It is a STABLE topological sort. Among cards that are free to go next it
 *     takes the one already highest in the column, so it moves only what the
 *     constraints force and preserves whatever priority ordering a human has
 *     imposed everywhere else. An unstable sort would be equally correct by the
 *     blocking rule and would reshuffle the column on every run.
 *
 *   - Only edges INSIDE the column constrain it. A blocker that is closed, or
 *     in another column, cannot be positioned relative to these cards, so it
 *     says nothing about their order.
 */
class BacklogOrder {
  /**
   * @param cards The column as the board currently reads it, top first.
   * @throws If `Blocked by` describes a cycle -- that is a data bug (a card
   *   blocking something that blocks it), and no order satisfies it.
   */
  static derive(cards: IBacklogCard[]): IBacklogOrderOutcome {
    const present = new Set(cards.map((card) => card.number));
    const blockers = new Map<number, number[]>();
    const dependents = new Map<number, number[]>();
    let constraints = 0;

    for (const card of cards) {
      const mine: number[] = [];
      for (const blocker of BlockedByField.parse(card.blockedBy)) {
        if (!present.has(blocker) || blocker === card.number) {
          continue;
        }
        mine.push(blocker);
        dependents.set(blocker, [
          ...(dependents.get(blocker) ?? []),
          card.number,
        ]);
        constraints += 1;
      }
      blockers.set(card.number, mine);
    }

    const remaining = new Map(cards.map((card, index) => [card.number, index]));
    const outstanding = new Map(
      cards.map((card) => [
        card.number,
        (blockers.get(card.number) ?? []).length,
      ]),
    );
    const order: IBacklogCard[] = [];
    const byNumber = new Map(cards.map((card) => [card.number, card]));

    while (remaining.size > 0) {
      // Free to go next, and highest in the column among those: the tie-break
      // is what makes this stable.
      let chosen: number | undefined;
      let chosenAt = Number.POSITIVE_INFINITY;
      for (const [issue, index] of remaining) {
        if (outstanding.get(issue) === 0 && index < chosenAt) {
          chosen = issue;
          chosenAt = index;
        }
      }
      if (chosen === undefined) {
        throw new Error(
          `\`Blocked by\` describes a cycle, so no order satisfies it:\n  ${BacklogOrder.describeCycle(
            [...remaining.keys()],
            blockers,
          )}\nFix the field on one of those cards; nothing is reordered.`,
        );
      }
      remaining.delete(chosen);
      order.push(byNumber.get(chosen) as IBacklogCard);
      for (const dependent of dependents.get(chosen) ?? []) {
        outstanding.set(dependent, (outstanding.get(dependent) as number) - 1);
      }
    }

    const moved = order.filter(
      (card, index) => cards[index]?.number !== card.number,
    );
    return { order, moved, constraints };
  }

  /**
   * The writes that turn `current` into `order`, in the sequence to apply them.
   *
   * Pure, and separate from performing them, so the decision is testable
   * without a board: the walk keeps a local model of the column and emits a
   * move only where a card is not already directly below its predecessor. A
   * column already in order therefore plans NOTHING, which is what most
   * scheduled runs find.
   *
   * The plan is not a minimum move set, and its cost is ASYMMETRIC. A card that
   * must sink from the head of the column is one write. A card sitting between
   * the already-correct prefix and the rest makes every later card hop over it,
   * one write each -- that shape cost 13 writes repairing #1443 on the real
   * board where relocating one card would have done.
   *
   * Left greedy deliberately. The minimum set is a longest-increasing-
   * subsequence problem, and it would buy fewer API calls only in the rare
   * drift case: the common case is a column already in order, which plans
   * nothing either way. A scrambled board is a worse failure than a chatty
   * repair, so the simpler walk keeps the risk down.
   */
  static plan(current: IBacklogCard[], order: IBacklogCard[]): IBacklogMove[] {
    const model = [...current];
    const moves: IBacklogMove[] = [];
    for (let index = 1; index < order.length; index += 1) {
      const card = order[index] as IBacklogCard;
      const above = order[index - 1] as IBacklogCard;
      if (model.indexOf(card) === model.indexOf(above) + 1) {
        continue;
      }
      moves.push({
        itemId: card.itemId,
        afterId: above.itemId,
        number: card.number,
      });
      model.splice(model.indexOf(card), 1);
      model.splice(model.indexOf(above) + 1, 0, card);
    }
    return moves;
  }

  /** One concrete cycle among the cards Kahn's algorithm could not place. */
  private static describeCycle(
    stuck: number[],
    blockers: Map<number, number[]>,
  ): string {
    const inCycle = new Set(stuck);
    const path: number[] = [];
    let current = stuck[0] as number;
    while (!path.includes(current)) {
      path.push(current);
      const next = (blockers.get(current) ?? []).find((issue) =>
        inCycle.has(issue),
      );
      if (next === undefined) {
        // Unreachable: a card is stuck only while a blocker of it is unplaced,
        // and every unplaced card is in `stuck`, so the find always hits. Kept
        // as a terminating guard rather than asserted away -- if that invariant
        // ever stops holding, this ends the walk instead of spinning.
        break;
      }
      current = next;
    }
    const from = path.indexOf(current);
    const loop = from === -1 ? path : path.slice(from);
    return [...loop, current]
      .map((issue) => `#${issue}`)
      .join(" is blocked by ");
  }
}

export default BacklogOrder;
