/**
 * #1556: TypeScript's "declared but never read" diagnostics, as a gate.
 *
 * `CLAUDE.md` says to use them for dead code. `tsconfig.json` sets `strict`
 * but leaves `noUnusedLocals` unset, so the compiler never emitted one and the
 * instruction named a mechanism that did not exist -- a local left dead by
 * #1574 went unflagged, which is how this was found.
 *
 * It cannot simply be turned on in `tsconfig.json`: ANTLR's generated parsers
 * carry unused locals, they are committed, and they must not be hand-edited.
 * TypeScript has no per-directory flag, so the check runs the compiler with the
 * flag and drops the generated files from the RESULT.
 *
 * The generated root is derived from the `antlr` npm script's own `-o`
 * argument rather than listed here, so moving the output moves this check with
 * it. knip solves the same problem with its own `ignore` globs; those two are
 * separate configs by necessity, which is exactly why neither may be a
 * hand-copied path.
 */

import IUnusedFinding from "../types/IUnusedFinding";

class UnusedCode {
  /** `tsc` diagnostic codes for "declared but never read". */
  private static readonly UNUSED_CODES = ["TS6133", "TS6138", "TS6196"];

  /**
   * The directory ANTLR writes into, taken from the `antlr` script's `-o`.
   *
   * Throws rather than defaulting: a silent fallback would make the check pass
   * over generated files it no longer recognizes, which is the failure this
   * module exists to prevent.
   */
  static generatedRoot(antlrScript: string): string {
    const match = /-o\s+(\S+)/.exec(antlrScript);
    if (match === null) {
      throw new Error(
        `Cannot derive the generated-parser root: the "antlr" script has no -o argument.\n  script: ${antlrScript}`,
      );
    }
    return match[1];
  }

  /** Whether a path is ANTLR output rather than authored source. */
  static isGenerated(file: string, generatedRoot: string): boolean {
    const path = file.split("\\").join("/");
    return path.startsWith(generatedRoot) && path.includes("/grammar/");
  }

  /** Parse `tsc` output, keeping only unused-declaration findings. */
  static parse(tscOutput: string): IUnusedFinding[] {
    const findings: IUnusedFinding[] = [];
    for (const line of tscOutput.split("\n")) {
      const match = /^(.+?)\((\d+),(\d+)\): error (TS\d+): (.+)$/.exec(
        line.trim(),
      );
      if (match === null) continue;
      if (!UnusedCode.UNUSED_CODES.includes(match[4])) continue;
      findings.push({
        file: match[1],
        line: Number(match[2]),
        column: Number(match[3]),
        message: match[5],
      });
    }
    return findings;
  }

  /** The findings a human must act on: everything outside generated output. */
  static authored(tscOutput: string, antlrScript: string): IUnusedFinding[] {
    const root = UnusedCode.generatedRoot(antlrScript);
    return UnusedCode.parse(tscOutput).filter(
      (f) => !UnusedCode.isGenerated(f.file, root),
    );
  }
}

export default UnusedCode;
