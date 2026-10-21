/**
 * Utility class for extracting information from parser contexts.
 *
 * Centralizes common patterns for getting source positions from ANTLR
 * parser contexts, providing consistent null handling across the codebase.
 */

import ISourcePosition from "./types/ISourcePosition";
import type ISourceSpan from "../types/ISourceSpan";

/**
 * Static utility methods for parser context operations
 */
class ParserUtils {
  /**
   * Extract source position from a parser context.
   *
   * Handles null/undefined start tokens gracefully, returning 0 for
   * missing values. This is the standard pattern used throughout cnx
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
   * `getPosition` above. It was not a style choice: `transpiler/data/` could
   * import `utils/`, and `data-cannot-import-logic` was `reachable: true`, so an
   * ANTLR import here would have let `data/ -> utils/ -> logic/parser/` fail the
   * layer gate from a module that never mentions the parser (#1297). #1444
   * moved both layers into 1.1 Discover and retired the rule. The structural
   * type stays because it costs nothing and needs no grammar import.
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
    stop?: {
      line?: number;
      column?: number;
      text?: string | null;
      start?: number;
      stop?: number;
    } | null;
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
      endColumn: stopColumn + ParserUtils.tokenWidth(ctx.stop),
    };
  }

  /**
   * How many characters the stop token actually occupies.
   *
   * Prefers the token's character offsets over `text.length`, because the two
   * disagree on the one token every file ends with: ANTLR's EOF reports
   * `text === "<EOF>"` -- five characters -- while occupying zero, with
   * `stop === start - 1`. Measured on `enum EColor { RED }`: `text.length` gives
   * 5 and `stop - start + 1` gives 0, so a context ending at EOF was reporting an
   * `endColumn` five past the end of the file. Reachable under error recovery.
   *
   * Falls back to `text.length` when offsets are absent, which is the case for
   * the structural literals unit tests construct.
   */
  private static tokenWidth(stop: {
    text?: string | null;
    start?: number;
    stop?: number;
  }): number {
    if (typeof stop.start === "number" && typeof stop.stop === "number") {
      return Math.max(0, stop.stop - stop.start + 1);
    }
    return stop.text?.length ?? 0;
  }
}

export default ParserUtils;
