#!/usr/bin/env tsx
/**
 * C-Next toolchain requirements documentation generator (Issue #1143)
 *
 * Derives docs/compatibility.md, and the toolchain-derived MISRA guideline
 * rows in docs/misra-compliance.md, from TOOLCHAIN_REQUIREMENTS -- the same
 * table the code generator records against. Prose that restates what codegen
 * does drifts; prose generated from what codegen declares cannot.
 *
 * Usage:
 *   npm run docs:toolchain          - regenerate the documentation
 *   npm run docs:toolchain:check    - fail if the committed copy is stale
 *
 * Modes are deliberately write/check/console rather than grammar-coverage's
 * report/check/console: its `check` never writes and never diffs, which is why
 * GRAMMAR-COVERAGE.md has drifted since January (see #1150). `check` here
 * regenerates in memory and diffs against what is committed.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import chalk from "chalk";
import prettier from "prettier";

import TOOLCHAIN_REQUIREMENTS from "../src/transpiler/constants/TOOLCHAIN_REQUIREMENTS";
import type IToolchainRequirement from "../src/transpiler/types/IToolchainRequirement";
import ToolchainRequirementUtils from "../src/utils/ToolchainRequirementUtils";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const compatibilityPath = join(rootDir, "docs", "compatibility.md");
const misraPath = join(rootDir, "docs", "misra-compliance.md");

const MISRA_BEGIN = "<!-- BEGIN GENERATED: toolchain-guidelines -->";
const MISRA_END = "<!-- END GENERATED: toolchain-guidelines -->";
const SUMMARY_BEGIN = "<!-- BEGIN GENERATED: misra-summary -->";
const SUMMARY_END = "<!-- END GENERATED: misra-summary -->";

/** Status buckets a guideline row can carry, longest-first for prefix matching. */
const MISRA_STATUSES = [
  "Not Enforced",
  "By Design",
  "Deviation",
  "Enforced",
  "Planned",
  "Partial",
  "N/A",
] as const;

/** Column order of the generated summary table. */
const SUMMARY_COLUMNS = [
  "Enforced",
  "By Design",
  "Partial",
  "Planned",
  "N/A",
  "Not Enforced",
  "Deviation",
] as const;

/**
 * No timestamp anywhere in the output. GRAMMAR-COVERAGE.md carries a
 * `> Generated: <ISO>` header, which churns the file on every run and makes a
 * `git status --porcelain` gate permanently red -- so nobody could gate on it,
 * and it drifted. See #1150.
 */
const GENERATED_BANNER = `<!-- GENERATED FILE - DO NOT EDIT.
     Source: src/transpiler/constants/TOOLCHAIN_REQUIREMENTS.ts
     Regenerate: npm run docs:toolchain -->`;

const requirements = Object.values(TOOLCHAIN_REQUIREMENTS);

/** Escape a table cell so inline code and pipes survive markdown. */
function cell(text: string): string {
  return text.replace(/\|/g, "\\|");
}

function code(text: string): string {
  return `\`${cell(text)}\``;
}

function conditional(): readonly IToolchainRequirement[] {
  // Asked through the shared predicate rather than a name prefix, so the doc
  // and the transpile-time report cannot disagree about what counts as free.
  return requirements.filter(
    (requirement) => !ToolchainRequirementUtils.isBaseline(requirement.key),
  );
}

function buildCompatibility(): string {
  const lines: string[] = [];
  lines.push(GENERATED_BANNER, "", "# Toolchain compatibility", "");

  lines.push(
    "## Policy",
    "",
    "C-Next's toolchain requirements are **per-feature, not global**.",
    "",
    "The baseline is C99 (C++11 with `--cpp`), and code that uses none of the",
    "features below really does compile with any conforming compiler. Each",
    "feature listed here adds a requirement *only to files that use it*: you pay",
    "for CMSIS only if you write a critical section, and for C11 only if you index",
    "the bits of a float.",
    "",
    "This file is generated from the transpiler's own requirements registry, so it",
    "cannot fall out of step with what the code generator emits. To see what *your*",
    "project needs -- as opposed to what C-Next might need -- transpile it: the",
    "requirements are reported at the end of the run.",
    "",
  );

  lines.push(
    "## Baseline",
    "",
    "| transpile mode | language standard | compiler | platform library |",
    "| -------------- | ----------------- | -------- | ---------------- |",
    `| C (default) | ${TOOLCHAIN_REQUIREMENTS["baseline-c"].standard} | any conforming | none |`,
    `| C++ (\`--cpp\`) | ${TOOLCHAIN_REQUIREMENTS["baseline-cpp"].standard} | any conforming | none |`,
    "",
  );

  lines.push(
    "## Conditional requirements",
    "",
    "| feature | you pay it when | mode | language standard | compiler | platform library | emitted |",
    "| ------- | --------------- | ---- | ----------------- | -------- | ---------------- | ------- |",
  );
  for (const requirement of conditional()) {
    // Escape each half once. `code()` already escapes, so running cell() over
    // the composed string turned `a || b` into `\\|\\|`, which markdown reads
    // as a literal backslash followed by a cell separator -- splitting the row.
    const when =
      requirement.condition === null
        ? cell(requirement.incurredBy)
        : `${cell(requirement.incurredBy)}, and ${code(requirement.condition)}`;
    const extensions =
      requirement.extensions.length > 0
        ? requirement.extensions.map(code).join(", ")
        : "any conforming";
    lines.push(
      `| ${cell(requirement.feature)} | ${when} | ` +
        `${requirement.modes.join(", ")} | ${requirement.standard} | ` +
        `${extensions} | ${requirement.platformLib === null ? "none" : cell(requirement.platformLib)} | ` +
        `${code(requirement.reason)} |`,
    );
  }
  lines.push("");

  lines.push("## Compiler version floors", "");
  const floors = requirements.filter(
    (requirement) => requirement.compiler !== null,
  );
  if (floors.length === 0) {
    lines.push(
      "**None.** No construct C-Next emits has a minimum compiler version.",
      "",
      "C-Next previously required GCC 5+ / Clang 3.8+ wherever an unsigned `clamp`",
      "helper was emitted, because those helpers called `__builtin_add_overflow` and",
      "friends. Those calls were unreachable -- the preceding range check is already",
      "a complete overflow test -- and were removed in #1143.",
      "",
    );
  } else {
    lines.push(
      "| feature | GCC | Clang | because |",
      "| --- | --- | --- | --- |",
    );
    for (const requirement of floors) {
      const floor = requirement.compiler!;
      lines.push(
        `| ${cell(requirement.feature)} | ${floor.gcc ?? "never"} | ` +
          `${floor.clang ?? "never"} | ${code(requirement.reason)} |`,
      );
    }
    lines.push("");
  }

  lines.push("## Compiler extensions", "");
  const withExtensions = conditional().filter(
    (requirement) => requirement.extensions.length > 0,
  );
  if (withExtensions.length === 0) {
    lines.push("**None.**", "");
  } else {
    lines.push(
      "These are not standard C or C++. GCC and Clang accept them; IAR, TI CGT,",
      "Keil and MSVC may not.",
      "",
      "| extension | used by | emitted |",
      "| --------- | ------- | ------- |",
    );
    for (const requirement of withExtensions) {
      lines.push(
        `| ${requirement.extensions.map(code).join(", ")} | ` +
          `${cell(requirement.feature)} | ${code(requirement.reason)} |`,
      );
    }
    lines.push("");
  }

  lines.push("## Platform libraries", "");
  const withPlatform = conditional().filter(
    (requirement) => requirement.platformLib !== null,
  );
  lines.push(
    "| library | feature | selected when | emitted |",
    "| ------- | ------- | ------------- | ------- |",
  );
  for (const requirement of withPlatform) {
    lines.push(
      `| ${cell(requirement.platformLib ?? "")} | ${cell(requirement.feature)} | ` +
        `${requirement.condition === null ? "always" : code(requirement.condition)} | ` +
        `${code(requirement.reason)} |`,
    );
  }
  lines.push("");

  lines.push(
    "## MISRA C:2012 guidelines affected",
    "",
    "See [misra-compliance.md](misra-compliance.md) for the full assessment.",
    "",
    "| guideline | features that bear on it |",
    "| --------- | ------------------------ |",
  );
  for (const [guideline, features] of misraIndex()) {
    lines.push(`| ${guideline} | ${features.map(cell).join(", ")} |`);
  }
  lines.push("");

  return lines.join("\n");
}

/** Inverted index: MISRA guideline id -> the features that bear on it. */
function misraIndex(): ReadonlyMap<string, readonly string[]> {
  const index = new Map<string, string[]>();
  for (const requirement of requirements) {
    for (const guideline of requirement.misra) {
      const features = index.get(guideline);
      if (features === undefined) index.set(guideline, [requirement.feature]);
      else if (!features.includes(requirement.feature))
        features.push(requirement.feature);
    }
  }
  return new Map(
    Array.from(index.entries()).sort(([left], [right]) =>
      left.localeCompare(right, undefined, { numeric: true }),
    ),
  );
}

/** The transcluded block for docs/misra-compliance.md. */
function buildMisraBlock(): string {
  const lines: string[] = [];
  lines.push(MISRA_BEGIN);
  lines.push("");
  lines.push("### Toolchain-derived guidelines");
  lines.push("");
  lines.push(
    "Generated from the transpiler's requirements registry by",
    "`npm run docs:toolchain`. These rows state what generated output actually",
    "contains, which is why they may read as deviations where a hand-written",
    "assessment claimed N/A.",
    "",
  );
  lines.push("| guideline | bears on | emitted constructs |");
  lines.push("| --------- | -------- | ------------------ |");
  for (const [guideline, features] of misraIndex()) {
    const constructs = requirements
      .filter((requirement) => requirement.misra.includes(guideline))
      .map((requirement) => code(requirement.reason));
    lines.push(
      `| ${guideline} | ${features.map(cell).join(", ")} | ${constructs.join("; ")} |`,
    );
  }
  lines.push("");
  lines.push(MISRA_END);
  return lines.join("\n");
}

/**
 * Count guideline statuses straight from the rows of misra-compliance.md.
 *
 * The per-guideline rows are the source of truth; the summary is an aggregate
 * of them. Hand-maintaining that aggregate is how it came to claim four
 * directives when the document lists thirteen -- the same retyping failure
 * this issue exists to remove, applied to a table rather than to prose.
 */
function buildSummaryBlock(document: string): string {
  const withoutGenerated = stripGeneratedBlocks(document);
  const counts = new Map<string, Map<string, number>>();
  const seen = new Set<string>();

  for (const line of withoutGenerated.split("\n")) {
    const match = /^\|\s*(Dir\s*\d+\.\d+|\d+\.\d+)\s*\|[^|]*\|([^|]*)\|/.exec(
      line,
    );
    if (match === null) continue;
    const id = match[1]!.replace(/\s+/g, " ").trim();
    if (seen.has(id)) continue;
    const cell = match[2]!.trim().replace(/\*/g, "");
    const status = MISRA_STATUSES.find((candidate) =>
      cell.startsWith(candidate),
    );
    if (status === undefined) continue;
    seen.add(id);
    const category = categoryOf(id);
    const row = counts.get(category) ?? new Map<string, number>();
    row.set(status, (row.get(status) ?? 0) + 1);
    counts.set(category, row);
  }

  const lines: string[] = [SUMMARY_BEGIN, "", "## Summary", ""];
  lines.push(`| Category | ${SUMMARY_COLUMNS.join(" | ")} |`);
  lines.push(`| --- | ${SUMMARY_COLUMNS.map(() => "---").join(" | ")} |`);
  for (const category of SUMMARY_CATEGORIES) {
    const row = counts.get(category) ?? new Map<string, number>();
    lines.push(
      `| ${category} | ` +
        SUMMARY_COLUMNS.map((column) => String(row.get(column) ?? 0)).join(
          " | ",
        ) +
        " |",
    );
  }
  lines.push("");
  lines.push(
    `Counted from the guideline tables below by \`npm run docs:toolchain\` ` +
      `(${seen.size} guidelines).`,
  );
  lines.push("");
  lines.push(SUMMARY_END);
  return lines.join("\n");
}

/** Category buckets, in the order the summary presents them. */
const SUMMARY_CATEGORIES = [
  "Directives (1-4)",
  "Rules 1-5",
  "Rules 6-10",
  "Rules 11-15",
  "Rules 16-22",
] as const;

function categoryOf(id: string): string {
  if (id.startsWith("Dir")) return "Directives (1-4)";
  const major = Number.parseInt(id.split(".")[0]!, 10);
  if (major <= 5) return "Rules 1-5";
  if (major <= 10) return "Rules 6-10";
  if (major <= 15) return "Rules 11-15";
  return "Rules 16-22";
}

/** Remove generated regions so their rows are not counted as guideline rows. */
function stripGeneratedBlocks(document: string): string {
  return document
    .replace(new RegExp(`${MISRA_BEGIN}[\\s\\S]*?${MISRA_END}`), "")
    .replace(new RegExp(`${SUMMARY_BEGIN}[\\s\\S]*?${SUMMARY_END}`), "");
}

/** Splice one generated block into a document between its markers. */
function splice(
  existing: string,
  beginMarker: string,
  endMarker: string,
  block: string,
): string {
  const begin = existing.indexOf(beginMarker);
  const end = existing.indexOf(endMarker);
  if (begin === -1 || end === -1) {
    throw new Error(
      `docs/misra-compliance.md is missing the ${beginMarker} / ${endMarker} markers`,
    );
  }
  return (
    existing.slice(0, begin) + block + existing.slice(end + endMarker.length)
  );
}

/**
 * Format through Prettier before writing or comparing.
 *
 * The pre-commit hook formats staged markdown, so a generator that emitted
 * unformatted output would produce a committed file that never matches what it
 * generates -- making `docs:toolchain:check` fail permanently in CI. Formatting
 * here keeps the generated file byte-identical to what the hook would produce.
 */
async function formatMarkdown(
  markdown: string,
  filepath: string,
): Promise<string> {
  const config = await prettier.resolveConfig(filepath);
  return prettier.format(markdown, {
    ...config,
    filepath,
    parser: "markdown",
  });
}

function readOrEmpty(path: string): string {
  try {
    return readFileSync(path, "utf-8");
  } catch {
    return "";
  }
}

async function main(): Promise<void> {
  const mode = process.argv[2] ?? "write";
  const compatibility = await formatMarkdown(
    buildCompatibility(),
    compatibilityPath,
  );
  const misraExisting = readOrEmpty(misraPath);
  const misraUpdated =
    misraExisting.length > 0
      ? await formatMarkdown(
          splice(
            splice(misraExisting, MISRA_BEGIN, MISRA_END, buildMisraBlock()),
            SUMMARY_BEGIN,
            SUMMARY_END,
            // Counted from the PRE-splice document, which is equivalent
            // precisely because stripGeneratedBlocks removes every generated
            // region either way -- so the aggregate reflects only the
            // hand-maintained guideline tables.
            buildSummaryBlock(misraExisting),
          ),
          misraPath,
        )
      : "";

  if (mode === "console") {
    process.stdout.write(compatibility);
    return;
  }

  if (mode === "check") {
    const stale: string[] = [];
    if (readOrEmpty(compatibilityPath) !== compatibility) {
      stale.push("docs/compatibility.md");
    }
    if (misraUpdated.length > 0 && misraExisting !== misraUpdated) {
      stale.push("docs/misra-compliance.md (generated block)");
    }
    if (stale.length > 0) {
      console.error(
        chalk.red("Toolchain documentation is stale:\n") +
          stale.map((file) => `  ${file}`).join("\n") +
          chalk.yellow("\n\nRun: npm run docs:toolchain"),
      );
      process.exit(1);
    }
    console.log(chalk.green("Toolchain documentation is up to date"));
    return;
  }

  writeFileSync(compatibilityPath, compatibility, "utf-8");
  if (misraUpdated.length > 0) {
    writeFileSync(misraPath, misraUpdated, "utf-8");
  }
  console.log(chalk.green("Wrote docs/compatibility.md"));
}

await main();
