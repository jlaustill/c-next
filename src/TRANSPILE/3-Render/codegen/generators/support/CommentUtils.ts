/**
 * Comment handling utilities.
 * Extracted from CodeGenerator.ts.
 */
import IComment from "../../../../../types/IComment";
import CommentFormatter from "../../CommentFormatter";

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

// Export as an object for consistent module pattern
const commentUtils = {
  formatLeadingComments,
};

export default commentUtils;
