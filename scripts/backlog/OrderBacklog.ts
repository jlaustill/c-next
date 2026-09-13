/**
 * Orders the board's Backlog column so a card sits below everything blocking it.
 *
 * Separated from `scripts/order-backlog.ts`, which is the entry point and does
 * nothing but set an exit code: the exit-code contract below is what CI depends
 * on (`:check` must exit 1 on drift and 0 when clean), and a module that runs
 * itself on import cannot be unit-tested at all.
 */

import chalk from "chalk";

import BacklogOrder from "./BacklogOrder";
import BlockedByField from "./BlockedByField";
import type IBacklogCard from "../types/IBacklogCard";
import type IBacklogMove from "../types/IBacklogMove";
import ProjectBoard from "../utils/ProjectBoard";

const COLUMN = "Backlog";

class OrderBacklog {
  /**
   * Performs a plan. Nothing is decided here -- `BacklogOrder.plan` owns which
   * moves are needed and in what sequence, so that decision is unit-tested
   * rather than reachable only against a live board.
   */
  private static apply(projectId: string, moves: IBacklogMove[]): void {
    for (const move of moves) {
      ProjectBoard.moveAfter(projectId, move.itemId, move.afterId);
    }
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

    const moves = BacklogOrder.plan(cards, outcome.order);
    OrderBacklog.apply(projectId, moves);
    console.log(
      chalk.green(`\nOrdered: ${moves.length} card(s) repositioned.`),
    );
    return 0;
  }
}

export default OrderBacklog;
