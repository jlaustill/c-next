/**
 * A comment lifted off the HIDDEN channel (ADR-043).
 *
 * Comments are anchored to a token at parse time rather than attached by
 * Prettier. Prettier decides leading-vs-trailing by looking for newlines in the
 * *current* text, so once the printer reflows a line the classification can
 * flip -- which showed up as a formatter that was not idempotent, moving a
 * block comment from one side of a `+` to the other on every run. An anchor
 * computed from the original token stream cannot drift.
 */
interface ICommentNode {
  type: "Comment";
  /** Verbatim source text, never reflowed. */
  value: string;
  /** True for a block comment, false for a line comment. */
  block: boolean;
  /** True for a `///` documentation comment (ADR-043). */
  documentation: boolean;
  /** Character offset of the first character. */
  start: number;
  /** Character offset of the last character. */
  end: number;
  /** 1-based line the comment starts on. */
  line: number;
  /**
   * 1-based line the comment ends on.
   *
   * A block comment spans lines, so measuring the gap to the next token from
   * `line` counts the comment's own body as blank lines and inserts a break
   * that was never in the source.
   */
  endLine: number;
  /** Blank line(s) separated this comment from what precedes it. */
  precededByBlankLine: boolean;
  /**
   * Nothing else followed the comment on its last line.
   *
   * A line comment always ends its line; a block comment may or may not. Both
   * `/* c *\/ code` and a block comment sitting alone on its own line are
   * written in real sources, and a formatter that picks one collapses the other
   * -- then reads its own output back differently on the next run.
   *
   * It is honoured for trailing comments as well as leading ones. Whether a
   * comment is read as trailing the token before it or leading the token after
   * it depends on where the line breaks fall, so the two must lay out the same
   * way or formatting oscillates between them forever.
   */
  endsItsLine: boolean;
}

export default ICommentNode;
