/**
 * Include directive and preprocessor handling.
 * Extracted from CodeGenerator.ts.
 */
import IncludeRewriter from "../../../../../transpiler/data/IncludeRewriter";
import type THeaderExtension from "../../../../../transpiler/types/THeaderExtension";
import invariant from "../../../../../utils/invariant";
import type IPlannedDirective from "../../types/IPlannedDirective";

/*
 * One preprocessor directive, reduced to what emission needs (#1445 box 3):
 * the three directive functions below read their nodes for exactly two
 * things, WHICH shape the parser matched and the directive's own text. The
 * shape is `IPlannedDirective`, which also says why `text` is handed over
 * verbatim.
 *
 * The `.trim()` stays HERE, on the string, rather than moving to the caller
 * with the walk. It is load-bearing and measurable: `getText()` on
 * `#define MY_FLAG  ` really does keep the trailing spaces (verified by
 * running the parser), while `#ifdef DEBUG` has none. Trimming at the caller
 * would move a tested behavior out from under the only test that can reach
 * it -- `.cnx` fixtures are prettier-formatted, so a define with trailing
 * whitespace cannot survive in the corpus to cover it.
 */

/**
 * Issue #349, #1467: Options for include transformation
 */
interface IIncludeTransformOptions {
  sourcePath: string | null;
  /**
   * Issue #1467: author spelling -> resolved header path, decided once by
   * PathResolver during discovery. This replaces the `includeDirs`/`inputs`
   * pair, which declared a full path resolution here that no production caller
   * ever fed -- so the `.c` silently used the fallback while claiming not to.
   */
  rewrites: ReadonlyMap<string, string>;
  /**
   * Issue #1319: the run's header extension (".h" or ".hpp"), not its mode.
   * Required -- it was `cppMode?: boolean` destructured with a `false` default
   * at two sites, so an options object that omitted it silently emitted `.h`.
   */
  headerExtension: THeaderExtension;
}

/*
 * ADR-010's `Included C-Next file not found` check stood here and is now
 * E0506 in pass 2.1 (#1322). It reached the user as
 * `1:0 Code generation failed: Error: …` -- no code to look up, and the wrong
 * line. `IncludeDirectiveAnalyzer` reports it at the directive.
 *
 * It was the ONLY thing failing the build for a missing quoted `.cnx`:
 * discovery warns about the same file and returns, so the run would have
 * exited 0 without it. That is why it moved rather than being deleted as
 * subsumed by the warning.
 */

/**
 * ADR-010: Transform #include directives, converting .cnx to .h or .hpp
 * Issue #941: Uses .hpp extension when the run emits C++
 * Validates that quoted .cnx files exist if sourcePath is available
 * Supports both <file.cnx> and "file.cnx" forms
 *
 * Issue #1467: which header an include names is decided by
 * `PathResolver.getHeaderIncludePath` and arrives in `rewrites`. This function
 * used to resolve angle includes itself, from options no caller supplied, while
 * the `.h` did a bare extension swap -- two derivations of one fact that agreed
 * only because both copied the author's spelling.
 */
const transformIncludeDirective = (
  includeText: string,
  options: IIncludeTransformOptions,
): string => {
  return IncludeRewriter.rewrite(
    includeText,
    options.rewrites,
    options.headerExtension,
  );
};

/**
 * Emit a #define directive.
 *
 * #1322: the two rejections that stood here (E0501 function-like, E0502 with a
 * value) are ADR-037 decisions and moved to pass 2.1's DefineDirectiveAnalyzer,
 * which reports them at the directive's own position instead of `1:0` with the
 * line spelled out in the message. What is left is the emission: a flag-only
 * define passes through, and nothing else can reach here.
 */
const processDefineDirective = (
  directive: IPlannedDirective,
): string | null => {
  invariant(
    directive.kind !== "define-function" && directive.kind !== "define-value",
    "E0501/E0502 reject this in pass 2.1, before this runs",
  );
  return directive.kind === "define-flag" ? directive.text.trim() : null;
};

/**
 * Process a conditional compilation directive (#ifdef, #ifndef, #else, #endif)
 * These are passed through unchanged
 */
const processConditionalDirective = (directive: IPlannedDirective): string => {
  return directive.text.trim();
};

/**
 * Process a preprocessor directive
 * - Flag-only defines (#define FLAG): pass through
 * - Value defines (#define FLAG value): ERROR E0502
 * - Function macros (#define NAME(args)): ERROR E0501
 * - Conditional directives: pass through
 */
const processPreprocessorDirective = (
  directive: IPlannedDirective,
): string | null => {
  if (directive.kind.startsWith("define-")) {
    return processDefineDirective(directive);
  }
  if (directive.kind === "conditional") {
    return processConditionalDirective(directive);
  }
  return null;
};

// Export as an object for consistent module pattern
const includeGenerators = {
  transformIncludeDirective,
  processDefineDirective,
  processConditionalDirective,
  processPreprocessorDirective,
};

export default includeGenerators;
