/**
 * #1827 box 4: no non-test module under `src/` starts a shell. `ToolchainDetector`
 * built three command lines from template literals and ran them with
 * `execSync`, and one value it interpolated came from the project being
 * compiled. This bans the APIs that start a shell, whatever their argument, so
 * a command line built into a variable first is caught too: `execSync` and
 * `exec` always run `/bin/sh`, and `spawn`/`execFile` do when given
 * `shell: true`. A process is started with an argument array (`execFileSync`,
 * `spawnSync`, `execFile`), so no shell parses a name or a path.
 */
import { describe, expect, it } from "vitest";

import SourceScan from "./SourceScan";

interface IShellApi {
  readonly name: string;
  readonly pattern: RegExp;
  /** One control per arm: a dropped alternative fails its own control. */
  readonly matches: readonly string[];
}

const SHELL_APIS: readonly IShellApi[] = [
  {
    name: "execSync",
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
    name: "exec imported from child_process",
    pattern:
      /import\s*\{[^}]*\bexec\b[^}]*\}\s*from\s*["'](?:node:)?child_process["']/g,
    matches: [
      'import { exec } from "node:child_process";',
      "import { execFile, exec } from 'child_process';",
      'import {\n  exec,\n  spawn,\n} from "node:child_process";',
    ],
  },
  {
    name: "shell: true",
    pattern: /\bshell:\s*true\b/g,
    matches: [
      "spawn(cc, args, { shell: true })",
      "execFile(cc, args, {\n  shell:true,\n})",
    ],
  },
];

/** Argument-array calls, and text that resembles a shell API, that start no shell. */
const NOT_A_SHELL = [
  'execFileSync(compiler, ["--version"], { encoding: "utf-8" })',
  "execFile(cc, args)",
  'spawnSync(cc, ["-E"], { input: "" })',
  "PATTERN.exec(line)",
  'import { execFile, spawnSync } from "node:child_process";',
  "{ shell: false }",
];

describe("no non-test module under src/ starts a shell", () => {
  for (const api of SHELL_APIS) {
    describe(api.name, () => {
      it("no non-test module under src/ uses it", () => {
        const hits = SourceScan.scan(api.pattern).map(
          (hit) => `${hit.file}: ${hit.text}`,
        );
        expect(hits).toEqual([]);
      });

      it.each(api.matches)("matches %j", (line) => {
        expect([...line.matchAll(api.pattern)]).toHaveLength(1);
      });
    });
  }

  // Population control: the scan reads the module that held the three sites.
  // Without it, a scan over the wrong population passes every arm above.
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
    for (const api of SHELL_APIS) {
      expect([...line.matchAll(api.pattern)]).toHaveLength(0);
    }
  });
});
