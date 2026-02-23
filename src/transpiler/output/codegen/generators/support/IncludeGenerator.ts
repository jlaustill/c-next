/**
 * Include directive and preprocessor handling.
 * Extracted from CodeGenerator.ts as part of ADR-053 A5.
 */
import * as path from "node:path";
import * as Parser from "../../../../logic/parser/grammar/CNextParser";
import CnxFileResolver from "../../../../data/CnxFileResolver";

/**
 * Issue #349: Options for include transformation
 */
interface IIncludeTransformOptions {
  sourcePath: string | null;
  includeDirs?: string[];
  inputs?: string[];
  cppMode?: boolean;
}

/**
 * Resolve angle-bracket include path from inputs.
 * SonarCloud S3776: Extracted from transformIncludeDirective().
 */
const resolveAngleIncludePath = (
  filename: string,
  sourcePath: string,
  includeDirs: string[],
  inputs: string[],
  cppMode: boolean,
): string | null => {
  if (inputs.length === 0) {
    return null;
  }

  const sourceDir = path.dirname(sourcePath);
  const searchPaths = [sourceDir, ...includeDirs];
  const foundPath = CnxFileResolver.findCnxFile(filename, searchPaths);

  if (!foundPath) {
    return null;
  }

  const relativePath = CnxFileResolver.getRelativePathFromInputs(
    foundPath,
    inputs,
  );

  const ext = cppMode ? ".hpp" : ".h";
  return relativePath ? relativePath.replace(/\.cnx$/, ext) : null;
};

/**
 * Process angle-bracket includes: #include <file.cnx>
 * SonarCloud S3776: Extracted from transformIncludeDirective().
 */
const transformAngleInclude = (
  includeText: string,
  filename: string,
  options: IIncludeTransformOptions,
): string => {
  const {
    sourcePath,
    includeDirs = [],
    inputs = [],
    cppMode = false,
  } = options;

  // Try to resolve the correct output path
  if (sourcePath) {
    const resolvedPath = resolveAngleIncludePath(
      filename,
      sourcePath,
      includeDirs,
      inputs,
      cppMode,
    );
    if (resolvedPath) {
      return includeText.replace(`<${filename}.cnx>`, `<${resolvedPath}>`);
    }
  }

  // Fallback: simple replacement
  const ext = cppMode ? ".hpp" : ".h";
  return includeText.replace(`<${filename}.cnx>`, `<${filename}${ext}>`);
};

/**
 * Process quote includes: #include "file.cnx"
 * SonarCloud S3776: Extracted from transformIncludeDirective().
 */
const transformQuoteInclude = (
  includeText: string,
  filepath: string,
  options: IIncludeTransformOptions,
): string => {
  const { sourcePath, cppMode = false } = options;

  // Validate .cnx file exists if we have source path
  if (sourcePath) {
    const sourceDir = path.dirname(sourcePath);
    const cnxPath = path.resolve(sourceDir, `${filepath}.cnx`);

    if (!CnxFileResolver.cnxFileExists(cnxPath)) {
      throw new Error(
        `Error: Included C-Next file not found: ${filepath}.cnx\n` +
          `  Searched at: ${cnxPath}\n` +
          `  Referenced in: ${sourcePath}`,
      );
    }
  }

  // Transform to .h or .hpp
  const ext = cppMode ? ".hpp" : ".h";
  return includeText.replace(`"${filepath}.cnx"`, `"${filepath}${ext}"`);
};

/**
 * ADR-010: Transform #include directives, converting .cnx to .h or .hpp
 * Issue #941: Uses .hpp extension when cppMode is true
 * Validates that .cnx files exist if sourcePath is available
 * Supports both <file.cnx> and "file.cnx" forms
 *
 * Issue #349: For angle-bracket includes, resolves the correct output path
 * by finding the .cnx file and calculating its relative path from inputs.
 * SonarCloud S3776: Refactored to use helper functions.
 */
const transformIncludeDirective = (
  includeText: string,
  options: IIncludeTransformOptions,
): string => {
  // Match: #include <file.cnx> or #include "file.cnx"
  const angleMatch = /#\s*include\s*<([^>]+)\.cnx>/.exec(includeText);
  if (angleMatch) {
    return transformAngleInclude(includeText, angleMatch[1], options);
  }

  const quoteMatch = /#\s*include\s*"([^"]+)\.cnx"/.exec(includeText);
  if (quoteMatch) {
    return transformQuoteInclude(includeText, quoteMatch[1], options);
  }

  // Not a .cnx include - pass through unchanged
  return includeText;
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
