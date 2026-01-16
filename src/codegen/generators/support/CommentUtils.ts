/**
 * Comment handling utilities.
 * Extracted from CodeGenerator.ts as part of ADR-053 A5.
 */
import IComment from "../../types/IComment";
import CommentExtractor from "../../CommentExtractor";
import CommentFormatter from "../../CommentFormatter";

/**
 * Get comments that appear before a parse tree node
 */
const getLeadingComments = (
  ctx: { start?: { tokenIndex: number } | null },
  extractor: CommentExtractor | null,
): IComment[] => {
  if (!extractor || !ctx.start) return [];
  return extractor.getCommentsBefore(ctx.start.tokenIndex);
};

/**
 * Get inline comments that appear after a parse tree node (same line)
 */
const getTrailingComments = (
  ctx: { stop?: { tokenIndex: number } | null },
  extractor: CommentExtractor | null,
): IComment[] => {
  if (!extractor || !ctx.stop) return [];
  return extractor.getCommentsAfter(ctx.stop.tokenIndex);
};

/**
 * Format leading comments with current indentation
 */
const formatLeadingComments = (
  comments: IComment[],
  formatter: CommentFormatter,
  indent: string,
): string[] => {
  if (comments.length === 0) return [];
  return formatter.formatLeadingComments(comments, indent);
};

/**
 * Format a trailing/inline comment
 */
const formatTrailingComment = (
  comments: IComment[],
  formatter: CommentFormatter,
): string => {
  if (comments.length === 0) return "";
  // Only use the first comment for inline
  return formatter.formatTrailingComment(comments[0]);
};

// Export as an object for consistent module pattern
const commentUtils = {
  getLeadingComments,
  getTrailingComments,
  formatLeadingComments,
  formatTrailingComment,
};

export default commentUtils;
