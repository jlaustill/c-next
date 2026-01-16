/**
 * Include directive and preprocessor handling.
 * Extracted from CodeGenerator.ts as part of ADR-053 A5.
 */
import * as fs from "fs";
import * as path from "path";
import * as Parser from "../../../parser/grammar/CNextParser";

/**
 * ADR-010: Transform #include directives, converting .cnx to .h
 * Validates that .cnx files exist if sourcePath is available
 * Supports both <file.cnx> and "file.cnx" forms
 */
const transformIncludeDirective = (
  includeText: string,
  sourcePath: string | null,
): string => {
  // Match: #include <file.cnx> or #include "file.cnx"
  const angleMatch = includeText.match(/#\s*include\s*<([^>]+)\.cnx>/);
  const quoteMatch = includeText.match(/#\s*include\s*"([^"]+)\.cnx"/);

  if (angleMatch) {
    const filename = angleMatch[1];
    // Angle brackets: system/library includes - no validation needed
    return includeText.replace(`<${filename}.cnx>`, `<${filename}.h>`);
  } else if (quoteMatch) {
    const filepath = quoteMatch[1];

    // Validate .cnx file exists if we have source path
    if (sourcePath) {
      const sourceDir = path.dirname(sourcePath);
      const cnxPath = path.resolve(sourceDir, `${filepath}.cnx`);

      if (!fs.existsSync(cnxPath)) {
        throw new Error(
          `Error: Included C-Next file not found: ${filepath}.cnx\n` +
            `  Searched at: ${cnxPath}\n` +
            `  Referenced in: ${sourcePath}`,
        );
      }
    }

    // Transform to .h
    return includeText.replace(`"${filepath}.cnx"`, `"${filepath}.h"`);
  }

  // Not a .cnx include - pass through unchanged
  return includeText;
};

/**
 * Extract the macro name from a #define directive
 */
const extractDefineName = (text: string): string => {
  const match = text.match(/#\s*define\s+([a-zA-Z_][a-zA-Z0-9_]*)/);
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
