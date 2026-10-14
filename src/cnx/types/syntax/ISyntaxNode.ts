import type ISourceSpan from "../ISourceSpan";

/**
 * What every plain-data syntax node carries (#1932): where it is written, and
 * how it is spelled.
 *
 * `written` is the node's tokens with each gap between two of them (spaces,
 * line breaks, comments) read as one space (`SourceSpelling`), so it carries no
 * comment into a message or into C. It is never `getText()`, which joins
 * tokens with no separator and re-lexes as different ones (`1 - -1` reads back
 * `1--1`). A decision reads the lowered shape, not this text.
 */
interface ISyntaxNode {
  readonly span: ISourceSpan;
  readonly written: string;
}

export default ISyntaxNode;
