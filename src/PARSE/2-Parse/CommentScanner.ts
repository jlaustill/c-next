import { CommonTokenStream, Token } from "antlr4ng";

import { CNextLexer } from "./grammar/CNextLexer";
import ECommentType from "../../types/ECommentType";
import IComment from "../../types/IComment";

/**
 * Reads comments off the HIDDEN channel of a parsed token stream (ADR-043).
 *
 * #1322: extracted from `CommentExtractor`, which was one class doing two
 * passes' work. Reading what comments a file contains is a fact about the
 * PARSE -- codegen needs it to re-attach comments to generated declarations,
 * and it decides nothing about whether the program is legal. Checking those
 * comments against MISRA C:2012 Rules 3.1 and 3.2 is a rejection, and belongs
 * in 2.1.
 *
 * While they were one class, `output/` had to import an analyzer to get at the
 * extraction half -- the edge `render-cannot-import-analyzers` forbids, and
 * the reason standing up `src/TRANSPILE/1-Analyze/` would otherwise have been
 * a rename rather than a boundary.
 */
class CommentScanner {
  private readonly tokenStream: CommonTokenStream;

  private comments: IComment[] | null = null;

  constructor(tokenStream: CommonTokenStream) {
    this.tokenStream = tokenStream;
  }

  /**
   * Extract all comments from the token stream
   */
  extractAll(): IComment[] {
    if (this.comments !== null) {
      return this.comments;
    }

    this.tokenStream.fill();
    this.comments = [];

    // Get all tokens and filter for comments on HIDDEN channel
    const size = this.tokenStream.size;
    for (let i = 0; i < size; i++) {
      const token = this.tokenStream.get(i);
      if (token.channel === Token.HIDDEN_CHANNEL) {
        const comment = this.tokenToComment(token);
        if (comment) {
          this.comments.push(comment);
        }
      }
    }

    return this.comments;
  }

  /**
   * Get comments that appear before a given token index
   */
  getCommentsBefore(tokenIndex: number): IComment[] {
    const hiddenTokens = this.tokenStream.getHiddenTokensToLeft(
      tokenIndex,
      Token.HIDDEN_CHANNEL,
    );
    if (!hiddenTokens) return [];

    const comments: IComment[] = [];
    for (const token of hiddenTokens) {
      const comment = this.tokenToComment(token);
      if (comment) {
        comments.push(comment);
      }
    }
    return comments;
  }

  /**
   * Get inline comments that appear after a given token index (same line)
   */
  getCommentsAfter(tokenIndex: number): IComment[] {
    const hiddenTokens = this.tokenStream.getHiddenTokensToRight(
      tokenIndex,
      Token.HIDDEN_CHANNEL,
    );
    if (!hiddenTokens) return [];

    const comments: IComment[] = [];
    const sourceToken = this.tokenStream.get(tokenIndex);
    const sourceLine = sourceToken.line;

    for (const token of hiddenTokens) {
      // Only include comments on the same line (inline comments)
      if (token.line !== sourceLine) break;

      const comment = this.tokenToComment(token);
      if (comment) {
        comments.push(comment);
      }
    }
    return comments;
  }

  /**
   * Convert a token to an IComment, or null if not a comment token
   */
  private tokenToComment(token: Token): IComment | null {
    const text = token.text;
    if (!text) return null;

    let type: ECommentType;
    let content: string;

    switch (token.type) {
      case CNextLexer.DOC_COMMENT:
        type = ECommentType.Doc;
        content = text.slice(3).trim(); // Remove ///
        break;
      case CNextLexer.LINE_COMMENT:
        type = ECommentType.Line;
        content = text.slice(2); // Remove //
        break;
      case CNextLexer.BLOCK_COMMENT:
        type = ECommentType.Block;
        content = text.slice(2, -2); // Remove /* and */
        break;
      default:
        return null; // Not a comment token (e.g., whitespace)
    }

    return {
      type,
      raw: text,
      content,
      line: token.line,
      column: token.column,
      tokenIndex: token.tokenIndex,
    };
  }

  /**
   * Get the length of the comment marker for column calculation
   */
  static markerLength(type: ECommentType): number {
    switch (type) {
      case ECommentType.Doc:
        return 3; // ///
      case ECommentType.Line:
        return 2; // //
      case ECommentType.Block:
        return 2; // /*
    }
  }
}

export default CommentScanner;
