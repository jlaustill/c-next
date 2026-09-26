/**
 * ADR-049: the single place a target name becomes a target description.
 *
 * The descriptions come from the target catalog (`targets/targets.cnx`), read
 * once per process; nothing here holds a second list of targets.
 *
 * Two consumers ask different questions of the same answer. The orchestrator
 * asks per file, before codegen, because the description shapes the code
 * emitted for that file. It also asks once per run, at Stage 4c, because MISRA
 * C:2012 Rule 5.1 is a whole-program property -- an identifier budget has to
 * be one number for the whole build, not whichever file generated last
 * (#1307 review).
 *
 * Both go through here so the pragma is parsed once, in one way.
 */

import type * as Parser from "../PARSE/2-Parse/grammar/CNextParser";
import type ITargetDescription from "../transpiler/types/ITargetDescription";
import TargetCatalogFile from "../transpiler/data/TargetCatalogFile";
import invariant from "./invariant";

/** The target a file or run falls back to when none is named */
const FALLBACK_TARGET = "host";

class TargetResolver {
  /**
   * The catalog's description for a named target, or undefined when the name
   * is unknown. Case-insensitive, matching `#pragma target` and `--target`.
   */
  static byName(name: string | undefined): ITargetDescription | undefined {
    if (!name) {
      return undefined;
    }
    return TargetCatalogFile.targets().get(name.toLowerCase());
  }

  /** Every name the catalog defines, aliases included */
  static names(): string[] {
    return [...TargetCatalogFile.targets().keys()];
  }

  /**
   * One file's target: the `--target` flag when it names a known target, else
   * the file's own `#pragma target`, else the fallback.
   *
   * @param cliTarget The `--target` flag, if given
   * @param pragmaTarget The file's `#pragma target`, if any
   */
  static forFile(
    cliTarget: string | undefined,
    pragmaTarget: string | undefined,
  ): ITargetDescription {
    if (cliTarget) {
      const fromCli = TargetResolver.byName(cliTarget);
      if (fromCli) {
        return fromCli;
      }
      console.warn(
        `Warning: Unknown target '${cliTarget}', falling back to pragma or default`,
      );
    }
    return TargetResolver.byName(pragmaTarget) ?? TargetResolver.fallback();
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
  ): ITargetDescription {
    const fromCli = TargetResolver.byName(cliTarget);
    if (fromCli) {
      return fromCli;
    }

    let narrowest = TargetResolver.fallback();
    for (const name of pragmaTargets) {
      const candidate = TargetResolver.byName(name);
      if (
        candidate &&
        candidate.external_identifier_chars <
          narrowest.external_identifier_chars
      ) {
        narrowest = candidate;
      }
    }
    return narrowest;
  }

  private static fallback(): ITargetDescription {
    const target = TargetResolver.byName(FALLBACK_TARGET);
    invariant(target, `the target catalog defines '${FALLBACK_TARGET}'`);
    return target;
  }
}

export default TargetResolver;
