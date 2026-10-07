import type ISourceSpan from "../ISourceSpan";

/**
 * What every plain-data syntax node carries (#1932): where it is written, and
 * the source text as written, spaces and all.
 *
 * `written` is for messages. It is never `getText()`, which joins tokens with
 * no separator and re-lexes as different ones (`1 - -1` reads back `1--1`).
 */
interface ISyntaxNode {
  readonly span: ISourceSpan;
  readonly written: string;
}

export default ISyntaxNode;
