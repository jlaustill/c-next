/**
 * Include directive and preprocessor handling.
 * Extracted from CodeGenerator.ts.
 */
import * as path from "node:path";
import * as Parser from "../../../../logic/parser/grammar/CNextParser";
import CnxFileResolver from "../../../../data/CnxFileResolver";
import IncludeRewriter from "../../../../data/IncludeRewriter";
import type THeaderExtension from "../../../../types/THeaderExtension";

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
 * Extract the macro name from a #define directive
 */
const extractDefineName = (text: string): string => {
  const match = /#\s*define\s+([a-zA-Z_]\w*)/.exec(text);
  return match ? match[1] : "unknown";
};

/**
 * Process a #define directive
 * Only flag-only defines are allowed; value and function macros produce errors
 */
const processDefineDirective = (
  ctx: Parser.DefineDirectiveContext,
): string | null => {
  const text = ctx.getText();

  // Check for function-like macro: #define NAME(
  if (ctx.DEFINE_FUNCTION()) {
    const name = extractDefineName(text);
    const line = ctx.start?.line ?? 0;
    throw new Error(
      `E0501: Function-like macro '${name}' is not allowed. ` +
        `Use inline functions instead. Line ${line}`,
    );
  }

  // Check for value define: #define NAME value
  if (ctx.DEFINE_WITH_VALUE()) {
    const name = extractDefineName(text);
    const line = ctx.start?.line ?? 0;
    throw new Error(
      `E0502: #define with value '${name}' is not allowed. ` +
        `Use 'const' instead: const u32 ${name} <- value; Line ${line}`,
    );
  }

  // Flag-only define: pass through
  if (ctx.DEFINE_FLAG()) {
    return text.trim();
  }

  return null;
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
  extractDefineName,
  processDefineDirective,
  processConditionalDirective,
  processPreprocessorDirective,
};

export default includeGenerators;
