#!/usr/bin/env tsx
/**
 * Orders the board's Backlog column so a card sits below everything blocking it.
 *
 * Usage:
 *   npm run backlog:order         - derive the order and apply it
 *   npm run backlog:order:check   - report drift, exit 1, write nothing
 *
 * The order is DERIVED from `Blocked by` every run and never recorded, the same
 * shape as `release:milestones`. Nothing stores "X goes above Y".
 *
 * Why this is a scheduled job and not an event handler: GitHub has NO Actions
 * trigger for Projects v2 at all -- `projects_v2_item` is an organization
 * webhook, and `project_card`/`project_column` were classic-Projects only. So
 * nothing can fire when `Blocked by` is edited, and a cron is the only thing
 * that closes that gap. The workflow also runs after `Project sync`, which is
 * what catches a card entering or leaving the column.
 */

import chalk from "chalk";

import BacklogOrder from "./backlog/BacklogOrder";
import BlockedByField from "./backlog/BlockedByField";
import type IBacklogCard from "./types/IBacklogCard";
import ProjectBoard from "./utils/ProjectBoard";

const COLUMN = "Backlog";

class OrderBacklog {
  /**
   * Applies `order` to the board, skipping cards already in place.
   *
   * Walks a local model of the column alongside the writes, so a run with
   * nothing to do issues NO mutations rather than re-chaining every card --
   * which is the case that matters, since most scheduled runs find the column
   * already correct.
   *
   * The write count is not minimal when there IS drift: one card moved far out
   * of place drags every card it passed, so repairing it costs a write each
   * rather than one. Computing the minimum move set is a longest-increasing-
   * subsequence problem, and at a column of this size the difference is a
   * handful of API calls on a six-hourly job -- not worth the complexity.
   */
  private static apply(
    projectId: string,
    current: IBacklogCard[],
    order: IBacklogCard[],
  ): number {
    const model = [...current];
    let writes = 0;
    for (let index = 1; index < order.length; index += 1) {
      const card = order[index] as IBacklogCard;
      const above = order[index - 1] as IBacklogCard;
      if (model.indexOf(card) === model.indexOf(above) + 1) {
        continue;
      }
      ProjectBoard.moveAfter(projectId, card.itemId, above.itemId);
      model.splice(model.indexOf(card), 1);
      model.splice(model.indexOf(above) + 1, 0, card);
      writes += 1;
    }
    return writes;
  }

  /** Every reference the parse declined, so a misread is visible in the log. */
  private static reportCitations(cards: IBacklogCard[]): void {
    for (const card of cards) {
      const declined = BlockedByField.citations(card.blockedBy);
      if (declined.length > 0) {
        console.log(
          chalk.dim(
            `  = #${card.number} cites ${declined
              .map((issue) => `#${issue}`)
              .join(", ")} in prose; not treated as blockers`,
          ),
        );
      }
    }
  }

  static run(checkOnly: boolean): number {
    const projectId = ProjectBoard.findProject();
    if (projectId === undefined) {
      console.error(
        chalk.red(`No project titled "${ProjectBoard.TITLE}".`),
        "Run: npm run project:setup",
      );
      return 1;
    }

    const cards = ProjectBoard.columnCards(projectId, COLUMN);
    console.log(chalk.blue(`${COLUMN}: ${cards.length} cards`));
    if (cards.length < 2) {
      console.log("Nothing to order.");
      return 0;
    }

    OrderBacklog.reportCitations(cards);
    const outcome = BacklogOrder.derive(cards);
    console.log(
      chalk.dim(
        `  = ${outcome.constraints} blocking constraint(s) inside the column`,
      ),
    );

    if (outcome.moved.length === 0) {
      console.log(
        chalk.green(
          "Already ordered: every blocker sits above what it blocks.",
        ),
      );
      return 0;
    }

    const rank = new Map(
      outcome.order.map((card, index) => [card.number, index]),
    );
    for (const card of outcome.moved) {
      const from = cards.findIndex((entry) => entry.number === card.number) + 1;
      console.log(
        `  ${chalk.yellow("~")} #${card.number} ${from} -> ${
          (rank.get(card.number) as number) + 1
        }  ${card.title.slice(0, 58)}`,
      );
    }

    if (checkOnly) {
      console.error(
        chalk.red(
          `\n${outcome.moved.length} card(s) out of order. Run: npm run backlog:order`,
        ),
      );
      return 1;
    }

    const writes = OrderBacklog.apply(projectId, cards, outcome.order);
    console.log(chalk.green(`\nOrdered: ${writes} card(s) repositioned.`));
    return 0;
  }
}

process.exitCode = OrderBacklog.run(process.argv[2] === "check");
