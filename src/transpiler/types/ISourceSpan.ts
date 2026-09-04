/**
 * Where a declaration sits in its file: four integers, and nothing else.
 *
 * It names no file. The symbol or diagnostic carrying a span already names one,
 * and duplicating it here would be a second place to disagree about which file
 * a position belongs to.
 *
 * ## Why a record and not two more fields
 *
 * Symbols used to carry a bare `sourceLine` and no column at all, which is why
 * 136 of 302 `.expected.error` fixtures began at `1:0` (#1316): a diagnostic
 * about a symbol had no position to report and fell back to the start of the
 * file. Adding a flat `sourceColumn` beside `sourceLine` would have fixed the
 * fallback and left the position scattered across the symbol, so nothing could
 * be handed a position without being handed the whole symbol.
 *
 * A span travels on its own. That is the point: the 86 modules holding an ANTLR
 * context outside `logic/parser/` mostly want a position, not a node (#1317),
 * and they cannot stop holding the node until the position can leave without it.
 *
 * ## Why it is not `ISourcePosition`
 *
 * `ISourcePosition` is a mutable two-field point used by the diagnostic
 * accumulators. Every field a symbol carries is `readonly`, so extending it
 * would hand every symbol a mutable line and column. A span is also a range
 * rather than a point -- it can underline a declaration, not just aim at its
 * first character.
 *
 * Serializable by construction: four numbers survive `JsonCodec` with no
 * encoder, which is what lets a symbol be cached (#1298 -- the parse tree could
 * not be, and that is the problem this type exists to route around).
 */
interface ISourceSpan {
  /** 1-based line of the first character. */
  readonly line: number;

  /** 0-based column of the first character, matching ANTLR's token column. */
  readonly column: number;

  /** 1-based line of the last character. Equals `line` for a single-line span. */
  readonly endLine: number;

  /**
   * 0-based column one past the last character -- an exclusive end, so
   * `endColumn - column` is the width of a span that fits on one line.
   */
  readonly endColumn: number;
}

export default ISourceSpan;
