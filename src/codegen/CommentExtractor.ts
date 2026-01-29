import { CommonTokenStream, Token } from "antlr4ng";
import { CNextLexer } from "../antlr_parser/grammar/CNextLexer";
import ECommentType from "./types/ECommentType";
import IComment from "./types/IComment";
import ICommentError from "./types/ICommentError";

/**
 * Extracts and validates comments from the HIDDEN channel (ADR-043)
 *
 * - Extracts LINE_COMMENT, BLOCK_COMMENT, DOC_COMMENT tokens
 * - Validates MISRA C:2012 Rule 3.1 (no nested comment markers)
 * - Validates MISRA C:2012 Rule 3.2 (no line-splice in line comments)
 */
class CommentExtractor {
  private readonly tokenStream: CommonTokenStream;

  private comments: IComment[] | null = null;

  private errors: ICommentError[] = [];

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
   * Validate all comments against MISRA C:2012 Rules 3.1 and 3.2
   */
  validate(): ICommentError[] {
    this.errors = [];
    const comments = this.extractAll();

    for (const comment of comments) {
      this.validateMisra31(comment);
      this.validateMisra32(comment);
    }

    return this.errors;
  }

  /**
   * Get validation errors
   */
  getErrors(): ICommentError[] {
    return this.errors;
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
   * MISRA C:2012 Rule 3.1: No nested comment markers
   * The character sequences /* and // shall not appear within a comment.
   * Exception: :// (URI pattern) is allowed per Amendment 4
   */
  private validateMisra31(comment: IComment): void {
    const content = comment.content;

    // Check for nested /* (not part of a URI)
    const nestedBlockStart = content.indexOf("/*");
    if (nestedBlockStart !== -1) {
      this.errors.push({
        rule: "3.1",
        message:
          "Nested comment marker '/*' found inside comment (MISRA C:2012 Rule 3.1)",
        line: comment.line,
        column:
          comment.column +
          this.getMarkerLength(comment.type) +
          nestedBlockStart,
      });
    }

    // Check for nested // (not part of a URI like ://)
    // Find all // occurrences and check if preceded by :
    let searchStart = 0;
    while (true) {
      const slashSlash = content.indexOf("//", searchStart);
      if (slashSlash === -1) break;

      // Check if this is part of a URI (preceded by :)
      const isUri = slashSlash > 0 && content[slashSlash - 1] === ":";

      if (!isUri) {
        this.errors.push({
          rule: "3.1",
          message:
            "Nested comment marker '//' found inside comment (MISRA C:2012 Rule 3.1)",
          line: comment.line,
          column:
            comment.column + this.getMarkerLength(comment.type) + slashSlash,
        });
        break; // Only report first occurrence
      }

      searchStart = slashSlash + 2;
    }
  }

  /**
   * MISRA C:2012 Rule 3.2: No line-splice in line comments
   * Line comments ending with \ cause undefined behavior
   */
  private validateMisra32(comment: IComment): void {
    // Only applies to line comments (// and ///)
    if (comment.type === ECommentType.Block) return;

    const content = comment.content;
    if (content.endsWith("\\")) {
      this.errors.push({
        rule: "3.2",
        message:
          "Line comment ends with '\\' which causes line-splice (MISRA C:2012 Rule 3.2)",
        line: comment.line,
        column: comment.column,
      });
    }
  }

  /**
   * Get the length of the comment marker for column calculation
   */
  private getMarkerLength(type: ECommentType): number {
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

export default CommentExtractor;
