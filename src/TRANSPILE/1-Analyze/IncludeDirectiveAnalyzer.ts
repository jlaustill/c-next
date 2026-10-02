/**
 * ADR-010 include directives: E0503, E0504, E0506.
 *
 * #1322. Three throws -- two in `TypeValidator` and one in `IncludeGenerator`
 * -- all reported as `1:0` with the real line appended to the message as
 * `Line N`, and the third with no error code at all.
 *
 * ## What this pass reads: discovery's answer, not discovery's inputs
 *
 * Whether an include resolves, and whether a header's C-Next source is where
 * the same include would find it, are decided once, by 1.1 Discover, while it
 * resolves the file's includes. This pass reads that answer per directive and
 * asks the file system nothing (#1672).
 *
 * #1322 and #1435 handed it discovery's INPUTS instead -- the search path and
 * the quoted-include directory -- because re-deriving them here had already
 * gone wrong twice: codegen's search path lacked the `--include` directories,
 * and its quoted directory started from `dirname(sourcePath)` where discovery
 * started from `workingDir`. With the inputs in hand this pass still made its
 * own decision, along its own branch between the two forms and its own copy
 * of the C-Next extensions. It joined an absolute angle include onto each
 * search directory, where discovery resolves it by its path, so E0504 missed
 * a header whose C-Next source sat beside it; and it asked the file system a
 * second time, so a file that appeared between the two asks was accepted
 * while the run never discovered it.
 *
 * ## E0506 was uncoded
 *
 * `Error: Included C-Next file not found` was a bare `throw new Error`, so it
 * reached the user as `1:0 Code generation failed: Error: …` with no code to
 * look up. It is the code the #1321 audit reserved for it. Discovery already
 * WARNS about the same missing file; the warning is not a diagnostic and the
 * run would exit 0 without this rule, which is why it is relocated rather than
 * deleted as subsumed.
 */

import { ParseTreeWalker } from "antlr4ng";
import { CNextListener } from "../../PARSE/2-Parse/grammar/CNextListener";
import * as Parser from "../../PARSE/2-Parse/grammar/CNextParser";
import ParserUtils from "../../utils/ParserUtils";
import invariant from "../../utils/invariant";
import IncludeDirectiveText from "../../utils/IncludeDirectiveText";
import IncludeDiscovery from "../../transpiler/data/IncludeDiscovery";
import IncludeDirective from "./helpers/IncludeDirective";
import IIncludeContext from "./types/IIncludeContext";
import IIncludeDirectiveError from "./types/IIncludeDirectiveError";

/** Files that carry definitions; including one duplicates every symbol in it. */
const IMPLEMENTATION_EXTENSIONS = new Set([
  ".c",
  ".cpp",
  ".cc",
  ".cxx",
  ".c++",
]);

const extensionOf = (path: string): string =>
  path.substring(path.lastIndexOf(".")).toLowerCase();

class IncludeDirectiveListener extends CNextListener {
  private readonly found: IIncludeDirectiveError[] = [];

  public constructor(private readonly context: IIncludeContext) {
    super();
  }

  public errors(): IIncludeDirectiveError[] {
    return this.found;
  }

  override enterIncludeDirective = (
    ctx: Parser.IncludeDirectiveContext,
  ): void => {
    const spec = IncludeDirective.of(ctx);
    if (spec === null) return;

    if (this.checkImplementationFile(ctx, spec)) return;
    const directive = IncludeDirectiveText.join(spec);
    if (this.checkMissingCnextFile(ctx, spec, this.resolutionOf(directive))) {
      return;
    }
    this.checkCnextAlternative(
      ctx,
      spec,
      this.context.cnextAlternatives.get(directive),
    );
  };

  /**
   * Discovery's answer for this directive. It reads a `.cnx` file's
   * directives with the grammar's own lexer (#1745), so every directive the
   * parser found has one.
   */
  private resolutionOf(directive: string): string | null {
    const resolved = this.context.resolutions.get(directive);
    invariant(
      resolved !== undefined,
      `1.1 Discover resolved every directive 1.2 parsed (missing ${directive})`,
    );
    return resolved;
  }

  /** E0503: `#include "helper.c"` -- a definition, not an interface. */
  private checkImplementationFile(
    ctx: Parser.IncludeDirectiveContext,
    spec: { path: string; isLocal: boolean },
  ): boolean {
    if (!IMPLEMENTATION_EXTENSIONS.has(extensionOf(spec.path))) return false;
    this.report(
      ctx,
      "E0503",
      `Cannot #include implementation file '${spec.path}'. Only header files (.h, .hpp) are allowed.`,
      "An implementation file defines its symbols, so including it defines them again in every includer (ADR-010); include the header instead.",
    );
    return true;
  }

  /**
   * E0506: `#include "helper.cnx"` naming a file that is not there.
   *
   * Quoted only, and resolved relative to the including file, because that is
   * what ADR-010 says a quoted include means. An angle include is searched
   * along the run's paths and its absence is discovery's warning to give.
   */
  private checkMissingCnextFile(
    ctx: Parser.IncludeDirectiveContext,
    spec: { path: string; isLocal: boolean },
    resolved: string | null,
  ): boolean {
    if (!IncludeDiscovery.isQuotedCNext(spec)) return false;
    if (resolved !== null) return false;
    // The help names no absolute path on purpose. The throw this replaces put
    // the resolved path in its message; it had no fixture, and the first one
    // written for it embedded this machine's checkout directory in an
    // `.expected.error`. A quoted include resolves relative to the including
    // file, so the spelling IS the relative answer and the directory is the
    // one the reader already has open.
    this.report(
      ctx,
      "E0506",
      `Included C-Next file not found: ${spec.path}`,
      "A quoted include is resolved relative to the file it appears in (ADR-010); check the spelling and the path from this file's own directory.",
    );
    return true;
  }

  /**
   * E0504: a header is included where its C-Next source sits beside it.
   *
   * The generated header and the `.cnx` describe the same interface, but only
   * the `.cnx` carries what the transpiler needs to check the call.
   */
  private checkCnextAlternative(
    ctx: Parser.IncludeDirectiveContext,
    spec: { path: string; isLocal: boolean },
    cnxPath: string | undefined,
  ): void {
    if (cnxPath === undefined) return;

    const instead = IncludeDirectiveText.join({
      path: cnxPath,
      isLocal: spec.isLocal,
    });
    this.report(
      ctx,
      "E0504",
      `Found ${IncludeDirectiveText.join(spec)} but '${cnxPath}' exists at the same location.\n       Use ${instead} instead to use the C-Next version.`,
      "The generated header describes the interface; the C-Next source is what the transpiler can check calls against (ADR-010).",
    );
  }

  private report(
    at: Parser.IncludeDirectiveContext,
    code: string,
    message: string,
    helpText: string,
  ): void {
    const { line, column } = ParserUtils.getPosition(at);
    this.found.push({ code, line, column, message, helpText });
  }
}

class IncludeDirectiveAnalyzer {
  public analyze(
    tree: Parser.ProgramContext,
    context: IIncludeContext,
  ): IIncludeDirectiveError[] {
    const listener = new IncludeDirectiveListener(context);
    ParseTreeWalker.DEFAULT.walk(listener, tree);
    return listener.errors();
  }
}

export default IncludeDirectiveAnalyzer;
