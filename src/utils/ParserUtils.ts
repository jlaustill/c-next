/**
 * Utility class for extracting information from parser contexts.
 *
 * Centralizes common patterns for getting source positions from ANTLR
 * parser contexts, providing consistent null handling across the codebase.
 */

import ISourcePosition from "./types/ISourcePosition";

/**
 * Static utility methods for parser context operations
 */
class ParserUtils {
  /**
   * Extract source position from a parser context.
   *
   * Handles null/undefined start tokens gracefully, returning 0 for
   * missing values. This is the standard pattern used throughout C-Next
   * for error reporting.
   *
   * @param ctx - Any parser context with a start token
   * @returns Position with line and column (defaults to 0 if unavailable)
   */
  static getPosition(ctx: {
    start?: { line?: number; column?: number } | null;
  }): ISourcePosition {
    return {
      line: ctx.start?.line ?? 0,
      column: ctx.start?.column ?? 0,
    };
  }
}

export default ParserUtils;
