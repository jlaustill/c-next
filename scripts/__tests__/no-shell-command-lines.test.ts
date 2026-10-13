/**
 * #1827 box 4: `ToolchainDetector` built three command lines from template
 * literals and ran them with `execSync`, i.e. `/bin/sh`, and one value it
 * interpolated came from the project being compiled. This guard holds the
 * non-test modules under `src/` to the argument-array APIs:
 *
 * - `execSync(` is not called, whatever its argument;
 * - an import from `child_process` is a named import of `execFile`,
 *   `execFileSync`, `spawn` or `spawnSync` only (aliases allowed), so `exec`,
 *   `execSync` under another name, a namespace and a default import are out;
 * - `child_process` is not loaded by `require(…)` or `import(…)`;
 * - no `shell` option is set to anything but the literal `false`.
 *
 * It is lexical. It cannot see a shell started on purpose through an allowed
 * API, e.g. `execFileSync("/bin/sh", ["-c", …])`.
 */
import { describe, expect, it } from "vitest";

import SourceScan from "./SourceScan";

interface IShellArm {
  readonly name: string;
  readonly pattern: RegExp;
  /** One control per arm: a dropped alternative fails its own control. */
  readonly matches: readonly string[];
}

const SAFE = String.raw`(?:execFile|execFileSync|spawn|spawnSync)(?:\s+as\s+\w+)?`;

const SHELL_ARMS: readonly IShellArm[] = [
  {
    name: "execSync call",
    pattern: /\bexecSync\(/g,
    matches: [
      "const result = execSync(`which ${name}`, {",
      "const result = execSync(`${compiler} --version`, {",
      "const result = execSync(\n  `echo | ${toolchain.cc} -E -Wp,-v - 2>&1`,",
      'execSync(command, { encoding: "utf-8" })',
      "child_process.execSync(cmd)",
    ],
  },
  {
    name: "child_process import beyond the argument-array APIs",
    pattern: new RegExp(
      String.raw`import\s+(?!type\b)(?!\{\s*${SAFE}(?:\s*,\s*${SAFE})*\s*,?\s*\}\s*from)[^;]*?from\s*["'](?:node:)?child_process["']`,
      "g",
    ),
    matches: [
      'import { exec } from "node:child_process";',
      "import { execFile, exec } from 'child_process';",
      'import {\n  exec,\n  spawn,\n} from "node:child_process";',
      'import { execSync } from "node:child_process";',
      'import { execSync as runShell } from "node:child_process";',
      'import * as childProcess from "node:child_process";',
      'import childProcess from "node:child_process";',
      'import cp, { execFile } from "child_process";',
    ],
  },
  {
    name: "child_process loaded dynamically",
    pattern: /\b(?:require|import)\(\s*["'](?:node:)?child_process["']\s*\)/g,
    matches: [
      'const cp = require("child_process");',
      "const cp = await import('node:child_process');",
      'require( "node:child_process" )',
    ],
  },
  {
    name: "shell option other than false",
    pattern: /[{,]\s*shell\s*(?::(?!\s*false\b)|[,}])/g,
    matches: [
      "spawn(cc, args, { shell: true })",
      "execFile(cc, args, {\n  shell:true,\n})",
      'spawn(cc, args, { shell: "/bin/sh" })',
      'spawn(cc, args, { shell: process.platform === "win32" })',
      "spawn(cc, args, { shell })",
      "spawn(cc, args, { cwd, shell, env })",
    ],
  },
];

/** Argument-array calls, and text that resembles a shell API, that start no shell. */
const NOT_A_SHELL = [
  'execFileSync(compiler, ["--version"], { encoding: "utf-8" })',
  "execFile(cc, args)",
  'spawnSync(cc, ["-E"], { input: "" })',
  "PATTERN.exec(line)",
  'import { execFile } from "node:child_process";',
  'import { execFileSync, spawnSync } from "node:child_process";',
  'import {\n  execFileSync,\n  spawnSync,\n} from "node:child_process";',
  'import { spawnSync as run } from "node:child_process";',
  'import type { SpawnSyncReturns } from "node:child_process";',
  "spawn(cc, args, { shell: false })",
  " * slide with the shell:",
];

describe("non-test modules under src/ start processes with argument arrays", () => {
  for (const arm of SHELL_ARMS) {
    describe(arm.name, () => {
      it("no non-test module under src/ matches", () => {
        const hits = SourceScan.scan(arm.pattern).map(
          (hit) => `${hit.file}: ${hit.text}`,
        );
        expect(hits).toEqual([]);
      });

      it.each(arm.matches)("matches %j", (line) => {
        expect([...line.matchAll(arm.pattern)]).toHaveLength(1);
      });
    });
  }

  // Population control: the scan reads the module that held the three sites.
  // Without it, a scan over the wrong population passes every arm above.
  // The scan skips comments by line; code after a closed block comment is
  // still code, and the arms must see it.
  it.each([
    ["const r = execSync(cmd);", false],
    ["/* MISRA note */ const r = execSync(cmd);", false],
    [" */ const r = execSync(cmd);", false],
    ["// const r = execSync(cmd);", true],
    ["/* const r = execSync(cmd); */", true],
    [" * const r = execSync(cmd);", true],
  ])("treats %j as comment: %s", (line, comment) => {
    expect(SourceScan.inComment(line, line.indexOf("execSync("))).toBe(comment);
  });

  it("scans the module that held the defect", () => {
    expect(
      SourceScan.sourceFiles().some((file) =>
        file.endsWith(
          "src/cnx/PARSE/1-Discover/preprocessor/ToolchainDetector.ts",
        ),
      ),
    ).toBe(true);
  });

  it.each(NOT_A_SHELL)("no arm matches %j", (line) => {
    for (const arm of SHELL_ARMS) {
      expect([...line.matchAll(arm.pattern)]).toHaveLength(0);
    }
  });
});
