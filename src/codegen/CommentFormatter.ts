import ECommentType from "./types/ECommentType.js";
import IComment from "./types/IComment.js";

/**
 * Formats comments for C output (ADR-043)
 *
 * - Line comments: Keep as // (C99+ mode)
 * - Block comments: Keep as block comments
 * - Doc comments: Convert /// to Doxygen format
 */
class CommentFormatter {
  /**
   * Format a single comment for C output
   * @param comment The comment to format
   * @param indent Indentation string (spaces)
   * @returns Formatted comment string
   */
  format(comment: IComment, indent: string = ""): string {
    switch (comment.type) {
      case ECommentType.Line:
        return `${indent}//${comment.content}`;

      case ECommentType.Block:
        return this.formatBlockComment(comment, indent);

      case ECommentType.Doc:
        return this.formatDocComment(comment, indent);
    }
  }

  /**
   * Format consecutive doc comments as a single Doxygen block
   * @param comments Array of consecutive doc comments
   * @param indent Indentation string
   * @returns Formatted Doxygen comment block
   */
  formatDocCommentGroup(comments: IComment[], indent: string = ""): string {
    if (comments.length === 0) return "";

    if (comments.length === 1) {
      return this.formatDocComment(comments[0], indent);
    }

    // Multiple doc comments -> single /** ... */ block
    const lines: string[] = [];
    lines.push(`${indent}/**`);

    for (const comment of comments) {
      const content = comment.content.trim();
      if (content) {
        lines.push(`${indent} * ${content}`);
      } else {
        lines.push(`${indent} *`);
      }
    }

    lines.push(`${indent} */`);
    return lines.join("\n");
  }

  /**
   * Format leading comments (comments that appear before code)
   * Groups consecutive doc comments into Doxygen blocks
   * @param comments Array of comments
   * @param indent Indentation string
   * @returns Array of formatted comment strings
   */
  formatLeadingComments(comments: IComment[], indent: string = ""): string[] {
    if (comments.length === 0) return [];

    const result: string[] = [];
    let docGroup: IComment[] = [];

    for (const comment of comments) {
      if (comment.type === ECommentType.Doc) {
        docGroup.push(comment);
      } else {
        // Flush any accumulated doc comments
        if (docGroup.length > 0) {
          result.push(this.formatDocCommentGroup(docGroup, indent));
          docGroup = [];
        }
        result.push(this.format(comment, indent));
      }
    }

    // Flush remaining doc comments
    if (docGroup.length > 0) {
      result.push(this.formatDocCommentGroup(docGroup, indent));
    }

    return result;
  }

  /**
   * Format a trailing/inline comment
   * @param comment The comment
   * @returns Formatted inline comment (with leading spaces)
   */
  formatTrailingComment(comment: IComment): string {
    switch (comment.type) {
      case ECommentType.Line:
      case ECommentType.Doc:
        return `  //${comment.content}`;

      case ECommentType.Block:
        // For inline block comments, keep on single line if possible
        if (!comment.content.includes("\n")) {
          return `  /*${comment.content}*/`;
        }
        // Multi-line block comment shouldn't be inline
        return `  /*${comment.content}*/`;
    }
  }

  /**
   * Format a block comment preserving internal structure
   */
  private formatBlockComment(comment: IComment, indent: string): string {
    const content = comment.content;

    // Single-line block comment
    if (!content.includes("\n")) {
      return `${indent}/*${content}*/`;
    }

    // Multi-line block comment - preserve structure
    const lines = content.split("\n");
    const result: string[] = [];
    result.push(`${indent}/*${lines[0]}`);

    for (let i = 1; i < lines.length - 1; i++) {
      result.push(`${indent}${lines[i]}`);
    }

    if (lines.length > 1) {
      result.push(`${indent}${lines[lines.length - 1]}*/`);
    }

    return result.join("\n");
  }

  /**
   * Format a single doc comment as Doxygen
   */
  private formatDocComment(comment: IComment, indent: string): string {
    const content = comment.content.trim();
    if (!content) {
      return `${indent}/** */`;
    }
    return `${indent}/** ${content} */`;
  }
}

export default CommentFormatter;
