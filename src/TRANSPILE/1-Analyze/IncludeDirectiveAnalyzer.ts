/**
 * ADR-010 include directives: E0503, E0504, E0506.
 *
 * #1322. Three throws -- two in `TypeValidator` and one in `IncludeGenerator`
 * -- all reported as `1:0` with the real line appended to the message as
 * `Line N`, and the third with no error code at all.
 *
 * ## What this pass may know, and what it is handed
 *
 * The two facts these rules need beyond the parse tree are the file being
 * analyzed and where its angle includes are searched, and NEITHER may be read
 * off shared state here. `CodeGenState.sourcePath` is written inside
 * `CodeGenerator.generate()`, which runs after the analyzers: measured, it is
 * `null` for the first file of a run and holds the PREVIOUS file's path for
 * every file after. A rule reading it would report against the wrong file, or
 * not at all, depending on include order -- the exact shape #1399 shipped.
 * Both facts are handed in by the caller instead, which holds them correctly.
 *
 * ## The search path is recorded, not re-derived -- and that closes a hole
 *
 * Codegen re-derived the angle search path from the source file's own
 * directory. Discovery builds it from that directory PLUS `--include`
 * directories PLUS the config's, so the two disagreed exactly where `--include`
 * was load-bearing: with `ext.h` and `ext.cnx` side by side in an `--include`
 * directory, `#include <ext.h>` transpiled at exit 0 and reported nothing,
 * while the same two files in the source's own directory reported E0504. Two
 * derivations of one fact, agreeing by coincidence. Discovery's list is now
 * recorded per file and read here, so there is one.
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
import { dirname, join, resolve } from "node:path";

import { CNextListener } from "../../transpiler/logic/parser/grammar/CNextListener";
import * as Parser from "../../transpiler/logic/parser/grammar/CNextParser";
import ParserUtils from "../../utils/ParserUtils";
import IncludeDirective from "./helpers/IncludeDirective";
import IIncludeContext from "./types/IIncludeContext";
import IIncludeDirectiveError from "./types/IIncludeDirectiveError";
import IIncludeSpec from "./types/IIncludeSpec";

/** Files that carry definitions; including one duplicates every symbol in it. */
const IMPLEMENTATION_EXTENSIONS = new Set([
  ".c",
  ".cpp",
  ".cc",
  ".cxx",
  ".c++",
]);

/** The header extensions ADR-010 admits. */
const HEADER_EXTENSIONS = new Set([".h", ".hpp"]);

/** The C-Next spellings an include may name (Issue #1467's set, one copy). */
const CNEXT_EXTENSIONS = [".cnx", ".cnext"];

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
    if (this.checkMissingCnextFile(ctx, spec)) return;
    this.checkCnextAlternative(ctx, spec);
  };

  /** E0503: `#include "helper.c"` -- a definition, not an interface. */
  private checkImplementationFile(
    ctx: Parser.IncludeDirectiveContext,
    spec: IIncludeSpec,
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
    spec: IIncludeSpec,
  ): boolean {
    if (!spec.isQuoted) return false;
    if (!CNEXT_EXTENSIONS.includes(extensionOf(spec.path))) return false;

    const target = resolve(dirname(this.context.sourcePath), spec.path);
    if (this.context.fileExists(target)) return false;
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
    spec: IIncludeSpec,
  ): void {
    if (!HEADER_EXTENSIONS.has(extensionOf(spec.path))) return;
    const cnxPath = spec.path.replace(/\.(h|hpp)$/i, ".cnx");

    const where = spec.isQuoted
      ? this.quotedAlternative(cnxPath)
      : this.angleAlternative(cnxPath);
    if (where === null) return;

    const open = spec.isQuoted ? '"' : "<";
    const close = spec.isQuoted ? '"' : ">";
    this.report(
      ctx,
      "E0504",
      `Found #include ${open}${spec.path}${close} but '${cnxPath}' exists at the same location.\n       Use #include ${open}${cnxPath}${close} instead to use the C-Next version.`,
      "The generated header describes the interface; the C-Next source is what the transpiler can check calls against (ADR-010).",
    );
  }

  /** A quoted include resolves beside the including file, and only there. */
  private quotedAlternative(cnxPath: string): string | null {
    const candidate = resolve(dirname(this.context.sourcePath), cnxPath);
    return this.context.fileExists(candidate) ? candidate : null;
  }

  /** An angle include is searched along the run's paths, in priority order. */
  private angleAlternative(cnxPath: string): string | null {
    for (const searchDir of this.context.searchPaths) {
      const candidate = join(searchDir, cnxPath);
      if (this.context.fileExists(candidate)) return candidate;
    }
    return null;
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
