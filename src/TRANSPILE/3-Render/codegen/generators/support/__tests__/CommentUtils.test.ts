/**
 * Unit tests for CommentUtils
 * Tests the comment handling utility functions
 */
import { describe, it, expect, vi } from "vitest";
import commentUtils from "../CommentUtils";
import CommentFormatter from "../../../CommentFormatter";
import ECommentType from "../../../../../../types/ECommentType";
import IComment from "../../../../../../types/IComment";

const { formatLeadingComments } = commentUtils;

describe("CommentUtils", () => {
  describe("formatLeadingComments", () => {
    it("should return empty array when no comments", () => {
      const formatter = {
        formatLeadingComments: vi.fn(),
      } as unknown as CommentFormatter;

      const result = formatLeadingComments([], formatter, "  ");

      expect(result).toEqual([]);
      expect(formatter.formatLeadingComments).not.toHaveBeenCalled();
    });

    it("should call formatter.formatLeadingComments with comments and indent", () => {
      const comments: IComment[] = [
        {
          type: ECommentType.Doc,
          raw: "///docs",
          content: "docs",
          line: 1,
          column: 0,
          tokenIndex: 0,
        },
      ];
      const formattedComments = ["    /** docs */"];
      const formatter = {
        formatLeadingComments: vi.fn().mockReturnValue(formattedComments),
      } as unknown as CommentFormatter;

      const result = formatLeadingComments(comments, formatter, "    ");

      expect(formatter.formatLeadingComments).toHaveBeenCalledWith(
        comments,
        "    ",
      );
      expect(result).toBe(formattedComments);
    });
  });
});
