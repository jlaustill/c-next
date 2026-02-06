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

  /**
   * Parse a "line:column message" prefix from an error message.
   *
   * CodeGenerator validation errors embed location as "line:col message".
   * This extracts the location and returns the clean message, or defaults
   * to line 1, column 0 if no prefix is found.
   */
  static parseErrorLocation(message: string): {
    line: number;
    column: number;
    message: string;
  } {
    const colonIdx = message.indexOf(":");
    if (colonIdx < 1) {
      return { line: 1, column: 0, message };
    }

    const lineStr = message.substring(0, colonIdx);
    if (!/^\d+$/.test(lineStr)) {
      return { line: 1, column: 0, message };
    }

    const afterColon = message.substring(colonIdx + 1);
    const spaceIdx = afterColon.indexOf(" ");
    if (spaceIdx < 1) {
      return { line: 1, column: 0, message };
    }

    const colStr = afterColon.substring(0, spaceIdx);
    if (!/^\d+$/.test(colStr)) {
      return { line: 1, column: 0, message };
    }

    return {
      line: Number.parseInt(lineStr, 10),
      column: Number.parseInt(colStr, 10),
      message: afterColon.substring(spaceIdx + 1),
    };
  }
}

export default ParserUtils;
