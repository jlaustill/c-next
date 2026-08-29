/**
 * ADR-049: the single place a target name becomes a set of capabilities.
 *
 * Two consumers ask different questions of the same answer. `CodeGenerator` asks
 * per file, at Stage 5, because the capabilities shape the code it emits.
 * `Transpiler` asks once per run, at Stage 4c, because MISRA C:2012 Rule 5.1 is
 * a whole-program property — an identifier budget has to be one number for the
 * whole build, not whichever file happened to generate last (#1307 review).
 *
 * Both go through here so the pragma is parsed once, in one way. Re-deriving the
 * target from source text at the second call site would have produced two
 * decisions that agree only while the corpus stays simple.
 */

import type * as Parser from "../transpiler/logic/parser/grammar/CNextParser";
import type ITargetCapabilities from "../transpiler/types/ITargetCapabilities";
import TARGET_CAPABILITIES from "../transpiler/constants/TARGET_CAPABILITIES";
import DEFAULT_TARGET from "../transpiler/constants/DEFAULT_TARGET";

class TargetResolver {
  /**
   * Capabilities for a named target, or undefined when the name is unknown.
   * Case-insensitive, matching `#pragma target` and `--target`.
   */
  static byName(name: string | undefined): ITargetCapabilities | undefined {
    if (!name) {
      return undefined;
    }
    return TARGET_CAPABILITIES[name.toLowerCase()];
  }

  /**
   * The target named by a file's `#pragma target`, or undefined when the file
   * declares none (or names one this transpiler does not know).
   */
  static fromPragma(tree: Parser.ProgramContext): string | undefined {
    for (const directive of tree.preprocessorDirective()) {
      const pragma = directive.pragmaDirective();
      if (!pragma) {
        continue;
      }
      // PRAGMA_TARGET captures "#pragma target <name>" as a single token.
      const match = /#\s*pragma\s+target\s+(\S+)/i.exec(pragma.getText());
      if (match) {
        return match[1].toLowerCase();
      }
    }
    return undefined;
  }

  /**
   * The capabilities a whole build must satisfy.
   *
   * An explicit `--target` names one target for every translation unit, so it
   * wins outright. Otherwise the files may each declare their own `#pragma
   * target`, and a whole-program identifier budget has to hold for all of them:
   * the narrowest budget wins, because an identifier pair that collides for the
   * strictest target in the build collides in that build.
   *
   * @param cliTarget The `--target` flag, if given
   * @param pragmaTargets Target names declared by the build's files
   */
  static forRun(
    cliTarget: string | undefined,
    pragmaTargets: ReadonlyArray<string>,
  ): ITargetCapabilities {
    const fromCli = TargetResolver.byName(cliTarget);
    if (fromCli) {
      return fromCli;
    }

    let narrowest = DEFAULT_TARGET;
    for (const name of pragmaTargets) {
      const candidate = TargetResolver.byName(name);
      if (
        candidate &&
        candidate.significantExternalIdentifierChars <
          narrowest.significantExternalIdentifierChars
      ) {
        narrowest = candidate;
      }
    }
    return narrowest;
  }
}

export default TargetResolver;
