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
   * Every directory ANTLR writes into, taken from the `antlr*` scripts' `-o`.
   *
   * Plural because there are three roots, not one: `antlr`, `antlr:c` and the
   * two `antlr:cpp:*` scripts each carry their own `-o`. Reading only the first
   * covered the other two by accident -- their paths happen to nest under the
   * C-Next one, so a `startsWith` test caught them. Moving either output out
   * from under `logic/parser` would have turned a dozen generated findings into
   * "authored dead code" with nothing pointing at the cause (#1580 review).
   *
   * Throws rather than defaulting: a silent fallback would make the check pass
   * over generated files it no longer recognizes, which is failing open -- the
   * defect this module exists to prevent.
   */
  static generatedRoots(scripts: Record<string, string>): string[] {
    const roots = Object.entries(scripts)
      .filter(([name]) => name === "antlr" || name.startsWith("antlr:"))
      .map(([, script]) => /-o\s+(\S+)/.exec(script)?.[1])
      .filter((root): root is string => root !== undefined);
    if (roots.length === 0) {
      throw new Error(
        "Cannot derive the generated-parser roots: no `antlr*` script has an -o argument.",
      );
    }
    return [...new Set(roots)];
  }

  /** Whether a path is ANTLR output rather than authored source. */
  static isGenerated(file: string, generatedRoots: string[]): boolean {
    const path = file.split("\\").join("/");
    return generatedRoots.some(
      (root) => path.startsWith(root) && path.includes("/grammar/"),
    );
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
  static authored(
    tscOutput: string,
    scripts: Record<string, string>,
  ): IUnusedFinding[] {
    const roots = UnusedCode.generatedRoots(scripts);
    return UnusedCode.parse(tscOutput).filter(
      (f) => !UnusedCode.isGenerated(f.file, roots),
    );
  }

  /**
   * Whether `tsc` output carries at least one positioned diagnostic.
   *
   * A non-zero exit alone proves nothing: `error TS5058: The specified path
   * does not exist` and a spawn failure both exit non-zero and carry no
   * `file(line,col)` prefix, so `parse()` drops them, the finding list is empty
   * and the gate reports a clean codebase. That is the same failing-open shape
   * `generatedRoots` throws to avoid, one level up, and it is the worse of the
   * two because it looks identical to success (#1580 review).
   */
  static ranAtAll(tscOutput: string): boolean {
    return /^.+\(\d+,\d+\): error TS\d+:/m.test(tscOutput);
  }
}

export default UnusedCode;
