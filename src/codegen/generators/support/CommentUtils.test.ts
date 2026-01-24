/**
 * Unit tests for CommentUtils
 * Tests the comment handling utility functions
 */
import { describe, it, expect, vi } from "vitest";
import commentUtils from "./CommentUtils";
import CommentExtractor from "../../CommentExtractor";
import CommentFormatter from "../../CommentFormatter";
import ECommentType from "../../types/ECommentType";
import IComment from "../../types/IComment";

const {
  getLeadingComments,
  getTrailingComments,
  formatLeadingComments,
  formatTrailingComment,
} = commentUtils;

describe("CommentUtils", () => {
  // ========================================================================
  // getLeadingComments
  // ========================================================================

  describe("getLeadingComments", () => {
    it("should return empty array when extractor is null", () => {
      const ctx = { start: { tokenIndex: 5 } };
      const result = getLeadingComments(ctx, null);
      expect(result).toEqual([]);
    });

    it("should return empty array when ctx.start is null", () => {
      const extractor = {
        getCommentsBefore: vi.fn(),
      } as unknown as CommentExtractor;
      const ctx = { start: null };

      const result = getLeadingComments(ctx, extractor);

      expect(result).toEqual([]);
      expect(extractor.getCommentsBefore).not.toHaveBeenCalled();
    });

    it("should return empty array when ctx.start is undefined", () => {
      const extractor = {
        getCommentsBefore: vi.fn(),
      } as unknown as CommentExtractor;
      const ctx = {};

      const result = getLeadingComments(ctx, extractor);

      expect(result).toEqual([]);
    });

    it("should call extractor.getCommentsBefore with token index", () => {
      const mockComments: IComment[] = [
        {
          type: ECommentType.Doc,
          raw: "/// documentation",
          content: "documentation",
          line: 1,
          column: 0,
          tokenIndex: 0,
        },
      ];
      const extractor = {
        getCommentsBefore: vi.fn().mockReturnValue(mockComments),
      } as unknown as CommentExtractor;
      const ctx = { start: { tokenIndex: 10 } };

      const result = getLeadingComments(ctx, extractor);

      expect(extractor.getCommentsBefore).toHaveBeenCalledWith(10);
      expect(result).toBe(mockComments);
    });
  });

  // ========================================================================
  // getTrailingComments
  // ========================================================================

  describe("getTrailingComments", () => {
    it("should return empty array when extractor is null", () => {
      const ctx = { stop: { tokenIndex: 5 } };
      const result = getTrailingComments(ctx, null);
      expect(result).toEqual([]);
    });

    it("should return empty array when ctx.stop is null", () => {
      const extractor = {
        getCommentsAfter: vi.fn(),
      } as unknown as CommentExtractor;
      const ctx = { stop: null };

      const result = getTrailingComments(ctx, extractor);

      expect(result).toEqual([]);
      expect(extractor.getCommentsAfter).not.toHaveBeenCalled();
    });

    it("should return empty array when ctx.stop is undefined", () => {
      const extractor = {
        getCommentsAfter: vi.fn(),
      } as unknown as CommentExtractor;
      const ctx = {};

      const result = getTrailingComments(ctx, extractor);

      expect(result).toEqual([]);
    });

    it("should call extractor.getCommentsAfter with token index", () => {
      const mockComments: IComment[] = [
        {
          type: ECommentType.Line,
          raw: "// inline",
          content: " inline",
          line: 5,
          column: 20,
          tokenIndex: 15,
        },
      ];
      const extractor = {
        getCommentsAfter: vi.fn().mockReturnValue(mockComments),
      } as unknown as CommentExtractor;
      const ctx = { stop: { tokenIndex: 14 } };

      const result = getTrailingComments(ctx, extractor);

      expect(extractor.getCommentsAfter).toHaveBeenCalledWith(14);
      expect(result).toBe(mockComments);
    });
  });

  // ========================================================================
  // formatLeadingComments
  // ========================================================================

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

  // ========================================================================
  // formatTrailingComment
  // ========================================================================

  describe("formatTrailingComment", () => {
    it("should return empty string when no comments", () => {
      const formatter = {
        formatTrailingComment: vi.fn(),
      } as unknown as CommentFormatter;

      const result = formatTrailingComment([], formatter);

      expect(result).toBe("");
      expect(formatter.formatTrailingComment).not.toHaveBeenCalled();
    });

    it("should format only the first comment", () => {
      const comments: IComment[] = [
        {
          type: ECommentType.Line,
          raw: "// first",
          content: " first",
          line: 1,
          column: 10,
          tokenIndex: 5,
        },
        {
          type: ECommentType.Line,
          raw: "// second",
          content: " second",
          line: 1,
          column: 20,
          tokenIndex: 6,
        },
      ];
      const formatter = {
        formatTrailingComment: vi.fn().mockReturnValue("  // first"),
      } as unknown as CommentFormatter;

      const result = formatTrailingComment(comments, formatter);

      expect(formatter.formatTrailingComment).toHaveBeenCalledTimes(1);
      expect(formatter.formatTrailingComment).toHaveBeenCalledWith(comments[0]);
      expect(result).toBe("  // first");
    });
  });
});
