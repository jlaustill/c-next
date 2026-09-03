/**
 * Utility class for extracting information from parser contexts.
 *
 * Centralizes common patterns for getting source positions from ANTLR
 * parser contexts, providing consistent null handling across the codebase.
 */

import ISourcePosition from "./types/ISourcePosition";
import type ISourceSpan from "../transpiler/types/ISourceSpan";

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
   * Extract a full source span from a parser context.
   *
   * Takes the context STRUCTURALLY rather than as an ANTLR type, the same as
   * `getPosition` above. That is not a style choice: `transpiler/data/` may
   * import `utils/`, and `data-cannot-import-logic` is `reachable: true`, so an
   * ANTLR import here would let `data/ -> utils/ -> logic/parser/` fail the
   * layer gate from a module that never mentions the parser (#1297).
   *
   * ANTLR's `stop` token is the LAST token of the rule, and its `column` is
   * where that token BEGINS. The exclusive end is therefore its column plus its
   * own width -- taking `stop.column` directly would underline every declaration
   * one token short, which reads as correct on a single-character final token
   * and is wrong everywhere else.
   *
   * A context with no `stop` (an error node, mid-recovery) yields a zero-width
   * span at `start`, so a caller always gets a well-ordered span and never has
   * to test for half-populated positions.
   *
   * @param ctx - Any parser context with start and stop tokens
   * @returns The span, defaulting to 0 for anything unavailable
   */
  static getSpan(ctx: {
    start?: { line?: number; column?: number } | null;
    stop?: { line?: number; column?: number; text?: string | null } | null;
  }): ISourceSpan {
    const line = ctx.start?.line ?? 0;
    const column = ctx.start?.column ?? 0;

    if (!ctx.stop) {
      return { line, column, endLine: line, endColumn: column };
    }

    const endLine = ctx.stop.line ?? line;
    const stopColumn = ctx.stop.column ?? column;
    return {
      line,
      column,
      endLine,
      endColumn: stopColumn + (ctx.stop.text?.length ?? 0),
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
