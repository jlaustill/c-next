#!/usr/bin/env tsx
/**
 * #1556: fail when authored code declares something it never reads.
 *
 * Runs `tsc --noUnusedLocals --noUnusedParameters` over every TypeScript
 * program and reports each finding outside ANTLR's generated output.
 *
 * `--noUnusedParameters` honours a leading underscore as "intentionally
 * unused", which is the escape hatch for a parameter a SIGNATURE requires --
 * a `TGeneratorFn` implementation, a positional callback. It is not an escape
 * hatch for a parameter nothing requires: 18 of the 20 found when this flag
 * was turned on were removable, and removing them took their arguments with
 * them. See `scripts/unused-code/UnusedCode.ts`
 * for why the flag cannot simply live in `tsconfig.json`.
 */

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join, sep } from "node:path";
import { fileURLToPath } from "node:url";

import chalk from "chalk";

import FileScanner from "./utils/FileScanner";
import UnusedCode from "./unused-code/UnusedCode";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Every TypeScript program in the repo, discovered rather than listed.
 *
 * CI typechecks three -- `tsconfig.json`, `tsconfig.scripts.json` and
 * `prettier-plugin/tsconfig.json` -- and a hand-written copy here was already
 * short the third, so the detector never ran on the plugin at all. That is the
 * file this PR deleted 45 dead lines from (#1580 review).
 *
 * Reading them off disk means a fourth program is covered the day it is added,
 * where a fourth entry in a list is remembered or it is not.
 */
function projects(): string[] {
  const found = [
    ...FileScanner.findFiles(rootDir, ".json").filter((f) =>
      /(^|[/\\])tsconfig[^/\\]*\.json$/.test(f),
    ),
  ]
    .filter((f) => !f.includes(`${sep}node_modules${sep}`))
    .map((f) =>
      f
        .slice(rootDir.length + 1)
        .split(sep)
        .join("/"),
    )
    .sort();
  if (found.length === 0) {
    throw new Error(
      "No tsconfig found: the check would silently cover nothing.",
    );
  }
  return found;
}

function tscOutput(project: string): string {
  let output: string;
  try {
    execFileSync(
      "npx",
      [
        "tsc",
        "--noEmit",
        "--noUnusedLocals",
        "--noUnusedParameters",
        "-p",
        project,
      ],
      { cwd: rootDir, encoding: "utf-8", stdio: "pipe" },
    );
    return "";
  } catch (error: unknown) {
    // A non-zero exit is the normal path -- tsc reports findings on stdout.
    const err = error as { stdout?: string; stderr?: string; message: string };
    output = err.stdout ?? err.stderr ?? err.message;
  }
  // ...but a non-zero exit with no positioned diagnostic means the compiler
  // never ran: a bad `-p`, a missing binary, no inputs. Returning it would
  // report a clean codebase forever.
  if (!UnusedCode.ranAtAll(output)) {
    throw new Error(`tsc did not run for ${project}:\n${output}`);
  }
  return output;
}

function main(): void {
  const scripts = (
    JSON.parse(readFileSync(join(rootDir, "package.json"), "utf-8")) as {
      scripts: Record<string, string>;
    }
  ).scripts;

  const findings = projects().flatMap((project) =>
    UnusedCode.authored(tscOutput(project), scripts),
  );

  // Deduplicate: the two programs overlap, since scripts/ imports from src/.
  const seen = new Map<string, string>();
  for (const f of findings) {
    seen.set(`${f.file}:${f.line}:${f.column}`, f.message);
  }

  if (seen.size === 0) {
    console.log(
      chalk.green(
        "No unused declarations or parameters outside generated output.",
      ),
    );
    return;
  }

  console.error(
    chalk.red(`${seen.size} unused declaration(s) in authored code:`),
  );
  for (const [where, message] of [...seen].sort()) {
    console.error(chalk.red(`  ${where}  ${message}`));
  }
  console.error(
    chalk.yellow(
      "Remove them, taking their arguments and assignments with them. Prefix with `_` ONLY when a signature requires the parameter.",
    ),
  );
  process.exit(1);
}

main();
