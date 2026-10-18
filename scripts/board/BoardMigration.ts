import BacklogOrder from "../backlog/BacklogOrder";
import type IBacklogCard from "../types/IBacklogCard";
import type IBacklogMove from "../types/IBacklogMove";
import type IBoardItem from "../types/IBoardItem";
import type IMigrationDiff from "../types/IMigrationDiff";
import type IStatusDrift from "../types/IStatusDrift";

/**
 * Decides what copying one project board onto another takes (#2189).
 *
 * Pure, and separate from `scripts/migrate-project.ts`, which only performs the
 * plan: the decisions are unit-tested rather than reachable only against a live
 * board. Every comparison is keyed by content id -- the issue or pull request's
 * node id -- never by number, because numbers repeat across repositories.
 *
 * Board order is data, not decoration: `BacklogOrder` is a stable sort that
 * keeps the order a human set, so a migration that scrambled it would discard
 * that ordering for good. The order is restored with `BacklogOrder.plan`, the
 * walk the Backlog column already uses, rather than a second one.
 */
class BoardMigration {
  /** Source cards the target lacks, in source order. */
  static missing(source: IBoardItem[], target: IBoardItem[]): IBoardItem[] {
    const held = new Set(target.map((card) => card.contentId));
    return source.filter((card) => !held.has(card.contentId));
  }

  /**
   * Cards held by both whose target Status differs from the source's. A source
   * card with no Status has nothing to copy, so it is never drift.
   */
  static statusDrift(
    source: IBoardItem[],
    target: IBoardItem[],
  ): IStatusDrift[] {
    const onTarget = new Map(target.map((card) => [card.contentId, card]));
    const drift: IStatusDrift[] = [];
    for (const card of source) {
      const copy = onTarget.get(card.contentId);
      if (
        copy === undefined ||
        card.status === undefined ||
        copy.status === card.status
      ) {
        continue;
      }
      drift.push({ item: copy, from: copy.status, to: card.status });
    }
    return drift;
  }

  /**
   * The repositions that put the target's copies of source cards in source
   * order. Cards only the target holds are left where they are; the copies are
   * arranged around them.
   */
  static orderMoves(
    source: IBoardItem[],
    target: IBoardItem[],
  ): IBacklogMove[] {
    const current: IBacklogCard[] = target.map((card) => ({
      number: card.number,
      itemId: card.itemId,
      blockedBy: [],
      title: `${card.repository}#${card.number}`,
    }));
    const byContent = new Map(
      target.map((card, index) => [
        card.contentId,
        current[index] as IBacklogCard,
      ]),
    );
    const order = source
      .map((card) => byContent.get(card.contentId))
      .filter((card): card is IBacklogCard => card !== undefined);
    return BacklogOrder.plan(current, order);
  }

  /** Everything the target still disagrees with the source about. */
  static diff(source: IBoardItem[], target: IBoardItem[]): IMigrationDiff {
    return {
      missing: BoardMigration.missing(source, target),
      statusDrift: BoardMigration.statusDrift(source, target),
      outOfOrder: BoardMigration.orderMoves(source, target).length,
    };
  }
}

export default BoardMigration;
