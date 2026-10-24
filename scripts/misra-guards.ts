#!/usr/bin/env tsx
/**
 * #1610: every **Enforced** or **By Design** row of docs/misra-compliance.md
 * names what fails if its compliance regresses. Rule 11.9 read **By Design**
 * while generated C wrote `Dev* d = {0};` at six sites, because the guard it
 * leaned on -- cppcheck's addon -- cannot see that shape, and nothing said so.
 *
 * Usage:
 *   npm run docs:misra-guards        - regenerate the doc's guard table
 *   npm run docs:misra-guards:check  - fail on a row with no guard, a guard
 *                                      that does not exist, or a stale table
 *
 * There is no exemption mechanism: a row with no guard yet names the open
 * issue that tracks adding one.
 */

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import chalk from "chalk";

import MisraBaseline from "./misra-baseline";
import TargetMatrix from "./TargetMatrix";
import TestUtils from "./test-utils";
import Repo from "./utils/Repo";
import MisraDump from "./misra-dump";
import MISRA_GUARDS from "./misra-guards/MISRA_GUARDS";
import MisraGuards from "./misra-guards/MisraGuards";
import type TMisraGuard from "./misra-guards/types/TMisraGuard";
import GeneratedMarkdown from "./utils/GeneratedMarkdown";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const misraPath = join(rootDir, "docs", "misra-compliance.md");

const BEGIN = "<!-- BEGIN GENERATED: misra-guards -->";
const END = "<!-- END GENERATED: misra-guards -->";

function assertedCodes(): Set<string> {
  const files = execFileSync("git", ["ls-files", "tests/*.expected.error"], {
    cwd: rootDir,
    encoding: "utf-8",
  })
    .split("\n")
    .filter((file) => file.length > 0);
  const codes = new Set<string>();
  for (const file of files) {
    const text = readFileSync(join(rootDir, file), "utf-8");
    for (const match of text.matchAll(/\berror\[(E\d{4})\]/g)) {
      codes.add(match[1]!);
    }
  }
  return codes;
}

function describe(guard: TMisraGuard, id: string): string {
  switch (guard.kind) {
    case "cppcheck":
      return `\`validate:c\` (cppcheck ${guard.rule ?? id})`;
    case "dump":
      return "`validate:c` dump check";
    case "compile-flag":
      return `C++ compile \`${guard.flag}\``;
    case "diagnostic":
      return `${guard.code} fixture`;
    case "script":
      return `\`npm run ${guard.script}\``;
    case "issue":
      return `none yet: #${guard.issue}`;
  }
}

function buildBlock(): string {
  const lines = [
    BEGIN,
    "",
    "### Regression guards",
    "",
    "What fails if an **Enforced** or **By Design** row regresses, from",
    "`scripts/misra-guards/MISRA_GUARDS.ts`. `npm run docs:misra-guards:check`",
    "fails when such a row has no guard or names one that does not exist",
    "(#1610). A row whose only guard is an issue has none yet.",
    "",
    "| guideline | guards |",
    "| --- | --- |",
  ];
  for (const [id, guards] of MISRA_GUARDS) {
    lines.push(`| ${id} | ${guards.map((g) => describe(g, id)).join("; ")} |`);
  }
  lines.push("", END);
  return lines.join("\n");
}

/**
 * Compile a C++ unit that uses a literal `0` as a null pointer the way the
 * integration tests compile every generated unit, and return what the compiler
 * printed -- so a compile-flag guard is checked by what the compile does, not
 * by whether its flag is spelled somewhere
 */
function compileProbe(): string {
  const dir = mkdtempSync(join(tmpdir(), "cnx-misra-guards-"));
  try {
    const unit = join(dir, "probe.cpp");
    writeFileSync(
      unit,
      "int main() { int* p = 0; return p == nullptr ? 0 : 1; }\n",
      "utf-8",
    );
    const toolchain = TargetMatrix.toolchainFor(TargetMatrix.HOST);
    if (typeof toolchain === "string") throw new Error(toolchain);
    const result = TestUtils.compileTranslationUnit(
      unit,
      dir,
      rootDir,
      "cpp",
      toolchain,
      false,
    );
    return result.valid ? "" : (result.message ?? "");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * Which of the issues the registry names are open. A lookup that fails is
 * an error, never "closed" or "open": either would make the check pass or
 * fail for a reason that is not true.
 */
function openIssues(issues: readonly number[]): Set<number> {
  const open = new Set<number>();
  for (const issue of issues) {
    const state = execFileSync(
      "gh",
      ["api", `repos/${Repo.slug()}/issues/${issue}`, "--jq", ".state"],
      { cwd: rootDir, encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"] },
    ).trim();
    if (state !== "open" && state !== "closed") {
      throw new Error(
        `gh api issues/${issue} returned '${state}', not a state`,
      );
    }
    if (state === "open") open.add(issue);
  }
  return open;
}

async function main(): Promise<void> {
  const mode = GeneratedMarkdown.requireMode(process.argv[2]);
  const document = readFileSync(misraPath, "utf-8");
  const packageJson = JSON.parse(
    readFileSync(join(rootDir, "package.json"), "utf-8"),
  ) as { scripts: Record<string, string> };

  const { rows, violations } = MisraGuards.evaluate(document, MISRA_GUARDS, {
    baselined: new Set(MisraBaseline.BASELINE.keys()),
    dumpRules: MisraDump.RULES,
    compileProbe: compileProbe(),
    openIssues: openIssues(MisraGuards.issues(MISRA_GUARDS)),
    assertedCodes: assertedCodes(),
    scripts: new Set(Object.keys(packageJson.scripts)),
  });
  const updated = await GeneratedMarkdown.format(
    GeneratedMarkdown.splice(document, BEGIN, END, buildBlock()),
    misraPath,
  );

  if (mode === "write") {
    writeFileSync(misraPath, updated, "utf-8");
  }
  for (const violation of violations) {
    console.log(`${chalk.red("error")}  ${violation.id}  ${violation.detail}`);
  }
  const claiming = rows.filter(
    (row) => row.status === "Enforced" || row.status === "By Design",
  ).length;
  console.log(
    `${rows.length} guideline row(s), ${claiming} Enforced or By Design, ${MISRA_GUARDS.size} with guards.`,
  );
  // A parser that finds no rows reports a clean document: broken, never clean
  if (claiming === 0) {
    console.log(chalk.red("Parsed no Enforced or By Design rows."));
    process.exit(1);
  }
  if (violations.length > 0) {
    console.log(chalk.red(`\n${violations.length} MISRA guard violation(s).`));
    process.exit(1);
  }
  if (mode === "check" && updated !== document) {
    console.log(
      chalk.red("docs/misra-compliance.md guard table is stale.") +
        chalk.yellow(" Run: npm run docs:misra-guards"),
    );
    process.exit(1);
  }
  console.log(chalk.green("Every compliance claim names a guard."));
}

await main();
