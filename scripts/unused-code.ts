#!/usr/bin/env tsx
/**
 * #1556: fail when authored code declares something it never reads.
 *
 * Runs `tsc --noUnusedLocals` over both programs and reports every finding
 * outside ANTLR's generated output. See `scripts/unused-code/UnusedCode.ts`
 * for why the flag cannot simply live in `tsconfig.json`.
 */

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import chalk from "chalk";

import UnusedCode from "./unused-code/UnusedCode";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Both programs: `tsconfig.json` covers src, `tsconfig.scripts.json` scripts. */
const PROJECTS = ["tsconfig.json", "tsconfig.scripts.json"];

function tscOutput(project: string): string {
  try {
    execFileSync(
      "npx",
      ["tsc", "--noEmit", "--noUnusedLocals", "-p", project],
      { cwd: rootDir, encoding: "utf-8", stdio: "pipe" },
    );
    return "";
  } catch (error: unknown) {
    // A non-zero exit is the normal path -- tsc reports findings on stdout.
    const err = error as { stdout?: string; stderr?: string; message: string };
    return err.stdout ?? err.stderr ?? err.message;
  }
}

function main(): void {
  const antlrScript = (
    JSON.parse(readFileSync(join(rootDir, "package.json"), "utf-8")) as {
      scripts: Record<string, string>;
    }
  ).scripts.antlr;

  const findings = PROJECTS.flatMap((project) =>
    UnusedCode.authored(tscOutput(project), antlrScript),
  );

  // Deduplicate: the two programs overlap, since scripts/ imports from src/.
  const seen = new Map<string, string>();
  for (const f of findings) {
    seen.set(`${f.file}:${f.line}:${f.column}`, f.message);
  }

  if (seen.size === 0) {
    console.log(
      chalk.green("No unused declarations outside generated output."),
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
      "Remove them. A write-only field needs its assignments removed too.",
    ),
  );
  process.exit(1);
}

main();
