/**
 * Include directive and preprocessor handling.
 * Extracted from CodeGenerator.ts.
 */
import * as path from "node:path";
import * as Parser from "../../../../logic/parser/grammar/CNextParser";
import CnxFileResolver from "../../../../data/CnxFileResolver";
import IncludeRewriter from "../../../../data/IncludeRewriter";
import type THeaderExtension from "../../../../types/THeaderExtension";
import invariant from "../../../../../utils/invariant";

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

/**
 * ADR-010: Validate that a quote-style include names a real `.cnx` file.
 *
 * Quote includes are resolved relative to the including file, so this can be
 * checked here; angle includes are searched along include directories and are
 * transformed without validation.
 *
 * `spec` carries its extension (`.cnx` or `.cnext`) -- Issue #1467 review: the
 * pattern that produces it lives in IncludeRewriter, so this module cannot
 * drift from the other producers on which extensions count.
 */
const validateQuoteInclude = (
  spec: string,
  sourcePath: string | null,
): void => {
  if (!sourcePath) {
    return;
  }

  const sourceDir = path.dirname(sourcePath);
  const cnxPath = path.resolve(sourceDir, spec);

  if (!CnxFileResolver.cnxFileExists(cnxPath)) {
    throw new Error(
      `Error: Included C-Next file not found: ${spec}\n` +
        `  Searched at: ${cnxPath}\n` +
        `  Referenced in: ${sourcePath}`,
    );
  }
};

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
  const quotedSpec = IncludeRewriter.quotedCnxSpecOf(includeText);
  if (quotedSpec) {
    validateQuoteInclude(quotedSpec, options.sourcePath);
  }

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
  ctx: Parser.DefineDirectiveContext,
): string | null => {
  invariant(
    !ctx.DEFINE_FUNCTION() && !ctx.DEFINE_WITH_VALUE(),
    "E0501/E0502 reject this in pass 2.1, before this runs",
  );
  return ctx.DEFINE_FLAG() ? ctx.getText().trim() : null;
};

/**
 * Process a conditional compilation directive (#ifdef, #ifndef, #else, #endif)
 * These are passed through unchanged
 */
const processConditionalDirective = (
  ctx: Parser.ConditionalDirectiveContext,
): string => {
  return ctx.getText().trim();
};

/**
 * Process a preprocessor directive
 * - Flag-only defines (#define FLAG): pass through
 * - Value defines (#define FLAG value): ERROR E0502
 * - Function macros (#define NAME(args)): ERROR E0501
 * - Conditional directives: pass through
 */
const processPreprocessorDirective = (
  ctx: Parser.PreprocessorDirectiveContext,
): string | null => {
  if (ctx.defineDirective()) {
    return processDefineDirective(ctx.defineDirective()!);
  }
  if (ctx.conditionalDirective()) {
    return processConditionalDirective(ctx.conditionalDirective()!);
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
