/**
 * The one place that knows how a generated Markdown document is produced and
 * how its CLI is invoked.
 *
 * Both halves used to be copied per generator. `formatMarkdown` existed in four
 * scripts (adr-matrix, diagnostic-manifest, toolchain-requirements,
 * scope-join-sites) and the write/check mode guard in two, which is the
 * duplicate-path anti-pattern this project forbids: the rule that generated
 * Markdown must be Prettier-formatted before it is written OR compared is one
 * decision, and it was written out four times. Changing how these documents are
 * formatted meant editing every generator in lockstep, and a generator that fell
 * out of step would emit a file that could never match its own check -- CI red
 * with nothing to fix in the document itself.
 */

import chalk from "chalk";
import prettier from "prettier";

class GeneratedMarkdown {
  /**
   * Format generated Markdown exactly as the committed file will be stored.
   *
   * The pre-commit hook formats staged Markdown, so a generator emitting
   * unformatted output would produce a committed file that never matches what it
   * generates -- making the check fail permanently in CI. Applied before writing
   * AND before comparing, so both sides of the diff are in the same shape.
   *
   * @param markdown The generator's raw output
   * @param filePath Where it will be written; Prettier resolves config by path
   */
  static async format(markdown: string, filePath: string): Promise<string> {
    const config = await prettier.resolveConfig(filePath);
    return prettier.format(markdown, {
      ...config,
      filepath: filePath,
      parser: "markdown",
    });
  }

  /**
   * The mode named by a CLI argument, or null when it names neither.
   *
   * Returns rather than exiting so the decision is reachable from a test: a
   * guard that can only be observed by watching a process die is a guard nobody
   * checks.
   *
   * Defaults to `check`, because that is what CI runs and an unqualified
   * invocation should never silently rewrite a committed document.
   */
  static parseMode(argument: string | undefined): "write" | "check" | null {
    const mode = argument ?? "check";
    return mode === "write" || mode === "check" ? mode : null;
  }

  /**
   * The mode this invocation asked for, or exit 1 explaining why not.
   *
   * The CLI-facing half of parseMode. Split so the decision stays pure and
   * testable while the process-ending half lives in exactly one place -- the
   * null check, the message and the exit were duplicated across every generator
   * that has two modes, which is one decision written twice.
   */
  static requireMode(argument: string | undefined): "write" | "check" {
    const mode = GeneratedMarkdown.parseMode(argument);
    if (mode === null) {
      console.error(
        chalk.red(`Unknown mode '${argument}'. Use write or check.`),
      );
      process.exit(1);
    }
    return mode;
  }
}

export default GeneratedMarkdown;
