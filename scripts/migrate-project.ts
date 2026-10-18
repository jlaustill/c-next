#!/usr/bin/env tsx
/**
 * Copies another project board onto the cnx board (Issue #2189).
 *
 * Usage:
 *   npm run project:migrate -- <user|organization> <owner> <number>
 *   npm run project:migrate:check -- <user|organization> <owner> <number>
 *
 * `migrate` adds every card the target lacks, in source order; gives each the
 * source's Status; restores source order; then verifies. `check` only
 * verifies, and exits 1 while anything differs -- so the migration's proof is
 * the same diff a re-run would act on.
 *
 * Idempotent: a re-run adds nothing already copied, writes no Status that
 * already matches, and moves nothing already in place. Interrupted, run it
 * again.
 *
 * What to copy is decided in `scripts/board/BoardMigration.ts`, where it is
 * unit-tested; this file only performs it.
 */

import chalk from "chalk";

import BoardMigration from "./board/BoardMigration";
import ProjectBoard from "./utils/ProjectBoard";

type TOwnerType = "user" | "organization";

/** Progress is reported this often, so a long run shows it is moving. */
const PROGRESS_EVERY = 50;

/** How many entries of each difference the report lists before summarizing. */
const REPORT_LIMIT = 10;

class MigrateProject {
  private static progress(done: number, total: number, what: string): void {
    if (done % PROGRESS_EVERY === 0 || done === total) {
      console.log(chalk.dim(`  ... ${done}/${total} ${what}`));
    }
  }

  static run(
    mode: "migrate" | "check",
    ownerType: TOwnerType,
    owner: string,
    number: number,
  ): number {
    const source = ProjectBoard.projectAt(ownerType, owner, number);
    const target = ProjectBoard.findProject();
    if (target === undefined) {
      console.error(
        chalk.red(`No project titled "${ProjectBoard.TITLE}".`),
        "Run: npm run project:setup",
      );
      return 1;
    }
    if (source.id === target.id) {
      console.error(chalk.red("The source and the target are the same board."));
      return 1;
    }
    console.log(`From: ${source.url}\nTo:   ${target.url}\n`);

    const sourceItems = ProjectBoard.items(source.id);
    const field = ProjectBoard.statusField(target.id);
    const optionIds = new Map(
      field.options.map((option) => [option.name, option.id]),
    );

    // Refuse before writing anything: a Status the target lacks would stop the
    // run part-way, with some cards copied and others not.
    const unknown = [
      ...new Set(
        sourceItems
          .map((card) => card.status)
          .filter(
            (name): name is string =>
              name !== undefined && !optionIds.has(name),
          ),
      ),
    ];
    if (unknown.length > 0) {
      console.error(
        chalk.red(
          `The target's ${ProjectBoard.STATUS_FIELD} has no option for: ${unknown.join(", ")}`,
        ),
        '\nAdd them in the UI (docs/WORKFLOW.md, "Board setup"), then re-run.',
      );
      return 1;
    }
    console.log(chalk.blue(`Source: ${sourceItems.length} cards`));

    if (mode === "migrate") {
      const missing = BoardMigration.missing(
        sourceItems,
        ProjectBoard.items(target.id),
      );
      console.log(
        chalk.blue(`Adding ${missing.length} card(s), in source order`),
      );
      missing.forEach((card, index) => {
        ProjectBoard.addItem(target.id, card.contentId);
        MigrateProject.progress(index + 1, missing.length, "added");
      });

      const drift = BoardMigration.statusDrift(
        sourceItems,
        ProjectBoard.items(target.id),
      );
      console.log(chalk.blue(`Writing ${drift.length} Status value(s)`));
      drift.forEach((entry, index) => {
        ProjectBoard.setStatus(
          target.id,
          entry.item.itemId,
          field.fieldId,
          optionIds.get(entry.to) as string,
        );
        MigrateProject.progress(index + 1, drift.length, "written");
      });

      const moves = BoardMigration.orderMoves(
        sourceItems,
        ProjectBoard.items(target.id),
      );
      console.log(chalk.blue(`Repositioning ${moves.length} card(s)`));
      moves.forEach((move, index) => {
        ProjectBoard.moveAfter(target.id, move.itemId, move.afterId);
        MigrateProject.progress(index + 1, moves.length, "moved");
      });
    }

    const diff = BoardMigration.diff(
      sourceItems,
      ProjectBoard.items(target.id),
    );
    const clean =
      diff.missing.length === 0 &&
      diff.statusDrift.length === 0 &&
      diff.outOfOrder === 0;
    console.log(chalk.bold("\nVerification"));
    console.log(`  missing:      ${diff.missing.length}`);
    for (const card of diff.missing.slice(0, REPORT_LIMIT)) {
      console.log(
        chalk.dim(
          `    ${card.repository}#${card.number} (${card.status ?? "no Status"})`,
        ),
      );
    }
    console.log(`  status drift: ${diff.statusDrift.length}`);
    for (const entry of diff.statusDrift.slice(0, REPORT_LIMIT)) {
      console.log(
        chalk.dim(
          `    ${entry.item.repository}#${entry.item.number}: ${entry.from ?? "unset"} -> ${entry.to}`,
        ),
      );
    }
    console.log(`  out of order: ${diff.outOfOrder} reposition(s) needed`);

    if (clean) {
      console.log(
        chalk.green(
          `\nAll ${sourceItems.length} cards copied, with Status and order.`,
        ),
      );
      return 0;
    }
    console.error(
      chalk.red(
        mode === "check"
          ? "\nThe target differs. Run: npm run project:migrate -- <owner type> <owner> <number>"
          : "\nThe target still differs after the run. Re-run it; it resumes.",
      ),
    );
    return 1;
  }
}

const [mode, ownerType, owner, rawNumber] = process.argv.slice(2);
if (
  (mode !== "migrate" && mode !== "check") ||
  (ownerType !== "user" && ownerType !== "organization") ||
  owner === undefined ||
  rawNumber === undefined
) {
  console.error(
    chalk.red(
      "Usage: migrate-project.ts <migrate|check> <user|organization> <owner> <number>",
    ),
  );
  process.exit(1);
}

try {
  process.exit(MigrateProject.run(mode, ownerType, owner, Number(rawNumber)));
} catch (error) {
  console.error(
    chalk.red(`\n${error instanceof Error ? error.message : String(error)}`),
  );
  process.exit(1);
}
