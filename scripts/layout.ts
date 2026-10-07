#!/usr/bin/env tsx
/**
 * Issue #1443: `src/` is the pass table. Fails when the first two levels of
 * `src/` differ from the tree in `docs/architecture/README.md` §1, when that
 * tree and `.dependency-cruiser.cjs`'s `PASS_ORDER` disagree, or when a
 * module reaches a later pass. It replaces `destinations:check`, whose map of
 * where each module was going is gone now that every module has arrived.
 *
 * No exemption mechanism, for the reason `gh-pagination.ts` gives: a gate that
 * can be opted out of eventually is. The three files directly under
 * `TRANSPILE/` are not an exemption -- the tree draws them.
 */

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import chalk from "chalk";

import Layout from "./layout/Layout";
import Depcruise from "./utils/Depcruise";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");

const tree = Layout.tree(
  readFileSync(join(rootDir, "docs", "architecture", "README.md"), "utf-8"),
);
const config = createRequire(import.meta.url)(
  join(rootDir, ".dependency-cruiser.cjs"),
) as { forbidden: Parameters<typeof Layout.places>[0] };

const failures = [
  ...Layout.shapeFailures(tree, Layout.present(join(rootDir, "src"), tree)),
  ...Layout.placeFailures(tree, Layout.places(config.forbidden)),
  ...Layout.orderFailures(
    config.forbidden.map((rule) => rule.name),
    Depcruise.violations(rootDir),
  ),
];

for (const failure of failures) {
  console.log(`${chalk.red("error")}  ${failure.kind}  ${failure.detail}`);
}

console.log(`Checked src/ against README §1's ${tree.length}-entry tree.`);

if (failures.length > 0) {
  console.log(
    chalk.red(`\nsrc/ is not the pass table: ${failures.length} failure(s).`),
  );
  console.log(
    "A missing or unexpected entry: move the module (`npm run move:modules`), or change the tree in README §1.",
  );
  console.log(
    "An order failure: the module reads a later pass. Move it to the pass whose artifact it reads, or stop reading it.",
  );
  console.log(
    "A place failure: README §1's tree and PASS_ORDER in `.dependency-cruiser.cjs` disagree. Change them together.",
  );
  process.exit(1);
}

console.log(chalk.green("src/ matches the pass table."));
