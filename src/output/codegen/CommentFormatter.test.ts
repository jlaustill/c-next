/**
 * Unit tests for CommentFormatter
 * ADR-043: Comment formatting for C output
 */
import { describe, it, expect, beforeEach } from "vitest";
import CommentFormatter from "./CommentFormatter";
import ECommentType from "./types/ECommentType";
import IComment from "./types/IComment";

describe("CommentFormatter", () => {
  let formatter: CommentFormatter;

  beforeEach(() => {
    formatter = new CommentFormatter();
  });

  // Helper to create comment objects
  const makeComment = (
    type: ECommentType,
    content: string,
    line = 1,
  ): IComment => ({
    type,
    raw:
      type === ECommentType.Doc
        ? `///${content}`
        : type === ECommentType.Line
          ? `//${content}`
          : `/*${content}*/`,
    content,
    line,
    column: 0,
    tokenIndex: 0,
  });

  // ========================================================================
  // format() - Single comment formatting
  // ========================================================================

  describe("format", () => {
    describe("line comments", () => {
      it("should format line comment without indent", () => {
        const comment = makeComment(ECommentType.Line, " hello world");
        expect(formatter.format(comment)).toBe("// hello world");
      });

      it("should format line comment with indent", () => {
        const comment = makeComment(ECommentType.Line, " hello");
        expect(formatter.format(comment, "    ")).toBe("    // hello");
      });
    });

    describe("block comments", () => {
      it("should format single-line block comment", () => {
        const comment = makeComment(ECommentType.Block, " block ");
        expect(formatter.format(comment)).toBe("/* block */");
      });

      it("should format single-line block comment with indent", () => {
        const comment = makeComment(ECommentType.Block, " block ");
        expect(formatter.format(comment, "  ")).toBe("  /* block */");
      });

      it("should format multi-line block comment", () => {
        const comment = makeComment(ECommentType.Block, " line1\n * line2\n ");
        const result = formatter.format(comment);
        expect(result).toContain("/*");
        expect(result).toContain("*/");
        expect(result).toContain("line1");
        expect(result).toContain("line2");
      });

      it("should preserve structure in multi-line block comment", () => {
        const comment = makeComment(
          ECommentType.Block,
          "\n * Description\n * @param x\n ",
        );
        const result = formatter.format(comment, "    ");
        expect(result).toContain("    /*");
      });
    });

    describe("doc comments", () => {
      it("should format doc comment as Doxygen", () => {
        const comment = makeComment(ECommentType.Doc, " Brief description");
        expect(formatter.format(comment)).toBe("/** Brief description */");
      });

      it("should format empty doc comment", () => {
        const comment = makeComment(ECommentType.Doc, "   ");
        expect(formatter.format(comment)).toBe("/** */");
      });

      it("should format doc comment with indent", () => {
        const comment = makeComment(ECommentType.Doc, " Description");
        expect(formatter.format(comment, "  ")).toBe("  /** Description */");
      });
    });
  });

  // ========================================================================
  // formatDocCommentGroup() - Multiple doc comments as Doxygen block
  // ========================================================================

  describe("formatDocCommentGroup", () => {
    it("should return empty string for empty array", () => {
      expect(formatter.formatDocCommentGroup([])).toBe("");
    });

    it("should format single doc comment same as format()", () => {
      const comments = [makeComment(ECommentType.Doc, " Single")];
      expect(formatter.formatDocCommentGroup(comments)).toBe("/** Single */");
    });

    it("should format multiple doc comments as single Doxygen block", () => {
      const comments = [
        makeComment(ECommentType.Doc, " First line"),
        makeComment(ECommentType.Doc, " Second line"),
        makeComment(ECommentType.Doc, " Third line"),
      ];
      const result = formatter.formatDocCommentGroup(comments);
      expect(result).toBe(
        "/**\n * First line\n * Second line\n * Third line\n */",
      );
    });

    it("should handle empty content in group", () => {
      const comments = [
        makeComment(ECommentType.Doc, " Description"),
        makeComment(ECommentType.Doc, ""),
        makeComment(ECommentType.Doc, " @param x"),
      ];
      const result = formatter.formatDocCommentGroup(comments);
      expect(result).toContain(" * Description");
      expect(result).toContain(" *\n"); // Empty line preserved
      expect(result).toContain(" * @param x");
    });

    it("should apply indent to all lines", () => {
      const comments = [
        makeComment(ECommentType.Doc, " Line 1"),
        makeComment(ECommentType.Doc, " Line 2"),
      ];
      const result = formatter.formatDocCommentGroup(comments, "    ");
      expect(result).toBe("    /**\n     * Line 1\n     * Line 2\n     */");
    });
  });

  // ========================================================================
  // formatLeadingComments() - Comments before code
  // ========================================================================

  describe("formatLeadingComments", () => {
    it("should return empty array for empty input", () => {
      expect(formatter.formatLeadingComments([])).toEqual([]);
    });

    it("should format single line comment", () => {
      const comments = [makeComment(ECommentType.Line, " TODO")];
      expect(formatter.formatLeadingComments(comments)).toEqual(["// TODO"]);
    });

    it("should format single block comment", () => {
      const comments = [makeComment(ECommentType.Block, " Note ")];
      expect(formatter.formatLeadingComments(comments)).toEqual(["/* Note */"]);
    });

    it("should group consecutive doc comments", () => {
      const comments = [
        makeComment(ECommentType.Doc, " First"),
        makeComment(ECommentType.Doc, " Second"),
      ];
      const result = formatter.formatLeadingComments(comments);
      expect(result.length).toBe(1);
      expect(result[0]).toContain("/**");
      expect(result[0]).toContain("First");
      expect(result[0]).toContain("Second");
    });

    it("should separate doc groups with other comment types", () => {
      const comments = [
        makeComment(ECommentType.Doc, " Doc 1"),
        makeComment(ECommentType.Line, " separator"),
        makeComment(ECommentType.Doc, " Doc 2"),
      ];
      const result = formatter.formatLeadingComments(comments);
      expect(result.length).toBe(3);
      expect(result[0]).toContain("Doc 1"); // First doc
      expect(result[1]).toBe("// separator"); // Line comment
      expect(result[2]).toContain("Doc 2"); // Second doc (separate)
    });

    it("should apply indent to all comments", () => {
      const comments = [
        makeComment(ECommentType.Line, " comment"),
        makeComment(ECommentType.Doc, " doc"),
      ];
      const result = formatter.formatLeadingComments(comments, "  ");
      expect(result[0]).toBe("  // comment");
      expect(result[1]).toBe("  /** doc */");
    });
  });

  // ========================================================================
  // formatTrailingComment() - Inline comments after code
  // ========================================================================

  describe("formatTrailingComment", () => {
    it("should format line comment with leading spaces", () => {
      const comment = makeComment(ECommentType.Line, " inline note");
      expect(formatter.formatTrailingComment(comment)).toBe("  // inline note");
    });

    it("should format doc comment as line comment style", () => {
      const comment = makeComment(ECommentType.Doc, " documented");
      expect(formatter.formatTrailingComment(comment)).toBe("  // documented");
    });

    it("should format single-line block comment", () => {
      const comment = makeComment(ECommentType.Block, " block ");
      expect(formatter.formatTrailingComment(comment)).toBe("  /* block */");
    });

    it("should format multi-line block comment (edge case)", () => {
      const comment = makeComment(ECommentType.Block, " line1\nline2 ");
      const result = formatter.formatTrailingComment(comment);
      expect(result).toBe("  /* line1\nline2 */");
    });
  });
});
