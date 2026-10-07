import { basename, relative, resolve } from "node:path";

import type IAnchorFacts from "../../../PARSE/1-Discover/types/IAnchorFacts";
import type ITranspileError from "../../../types/ITranspileError";
import CodedErrorText from "../../../utils/CodedErrorText";
import HeaderGeneratorUtils from "./HeaderGeneratorUtils";

/**
 * Which include guard each generated header carries, and the E0203 check that
 * no two carry the same one (ADR-063, #1133). Beside the guard's spelling,
 * `HeaderGeneratorUtils.makeGuard`, so the check reads the same function the
 * render does; #1443 moved both out of the orchestrator.
 */
class IncludeGuards {
  /**
   * Path identifying a source file for include-guard construction (issue #1133).
   *
   * Anchored on the PROJECT ROOT, not the input directory, so the guard for a
   * given file does not depend on which entry point pulled it in. Building
   * `app.cnx` and building `can/config.cnx` directly must produce the same guard
   * for can/config.cnx — otherwise separately-compiled translation units
   * reintroduce the collision as soon as a consumer includes both headers.
   *
   * Falls back to the input directory when no project marker is found, and to
   * the basename for a file outside that base. Both fallbacks can in principle
   * map two files onto one guard; that is what E0203 is for.
   */
  static identity(anchor: IAnchorFacts, sourcePath: string): string {
    const base = anchor.projectRoot ?? anchor.directory;
    const relativePath = relative(base, resolve(sourcePath));

    return relativePath.startsWith("..") || relativePath === ""
      ? basename(sourcePath)
      : relativePath;
  }

  /**
   * Reject two source files that would produce the same include guard.
   *
   * ADR-063 builds the guard from the project-relative path in upper case, with
   * non-alphanumerics collapsed to `_`. That keeps the generated artifact
   * readable but is NOT injective — the case change is lossy, so `mod-a.cnx` and
   * `mod_a.cnx` both land on CNX_MOD_A_H, as do filenames differing only by
   * case. This check is what makes that residue loud instead of silent: before
   * it, the preprocessor skipped the second header and the program ran with an
   * implicitly-declared function and a wrong value (#1133).
   */
  static collisions(
    anchor: IAnchorFacts,
    sourcePaths: readonly string[],
  ): ITranspileError[] {
    const sourceByGuard = new Map<string, string>();
    const errors: ITranspileError[] = [];

    for (const sourcePath of sourcePaths) {
      const guard = HeaderGeneratorUtils.makeGuard(
        IncludeGuards.identity(anchor, sourcePath),
      );
      const existing = sourceByGuard.get(guard);

      if (existing === undefined) {
        sourceByGuard.set(guard, sourcePath);
        continue;
      }

      // The code is embedded in the message: ITranspileError carries no `code`
      // field, and runAnalyzers formats analyzer codes the same way.
      errors.push({
        line: 1,
        column: 0,
        message: CodedErrorText.of(
          "E0203",
          `Source files '${basename(existing)}' and '${basename(sourcePath)}' both ` +
            `produce the include guard '${guard}'. Rename one so the generated headers stay distinguishable.`,
        ),
        severity: "error",
      });
    }

    return errors;
  }
}

export default IncludeGuards;
