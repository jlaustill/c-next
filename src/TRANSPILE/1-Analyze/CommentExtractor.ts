import ECommentType from "../../transpiler/types/ECommentType";
import CommentScanner from "../../transpiler/logic/parser/CommentScanner";
import IComment from "../../transpiler/types/IComment";
import ICommentError from "../../transpiler/types/ICommentError";

/**
 * Validates comments against MISRA C:2012 Rules 3.1 and 3.2 (ADR-043).
 *
 * #1322: the extraction half is `CommentScanner`, in the parser. This is the
 * rejection half, and a rejection is 2.1's to author. The split is what lets
 * codegen read comments -- which it must, to re-attach them -- without
 * importing an analyzer.
 *
 * #1445: it takes the comments rather than the token stream they came off.
 * Scanning was 2.1 re-deriving a fact about the PARSE, which is what the
 * lifetime axis forbids -- so 1.2 now carries them on `IParsedFile` and this
 * class names no parse type at all. `CommentScanner` remains imported for
 * `markerLength`, a pure function of the comment kind; the confinement rule is
 * direct rather than reachable, because its claim is about what a pass's
 * source NAMES.
 */
class CommentExtractor {
  private readonly comments: readonly IComment[];

  private errors: ICommentError[] = [];

  constructor(comments: readonly IComment[]) {
    this.comments = comments;
  }

  /**
   * Validate all comments against MISRA C:2012 Rules 3.1 and 3.2
   */
  validate(): ICommentError[] {
    this.errors = [];

    for (const comment of this.comments) {
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
          CommentScanner.markerLength(comment.type) +
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
            comment.column +
            CommentScanner.markerLength(comment.type) +
            slashSlash,
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
        message: String.raw`Line comment ends with '\' which causes line-splice (MISRA C:2012 Rule 3.2)`,
        line: comment.line,
        column: comment.column,
      });
    }
  }
}

export default CommentExtractor;
