import type ISourceSpan from "../types/ISourceSpan";

/**
 * The order a reader meets two positions in one file: earlier line first,
 * then earlier column. Diagnostics from several walks are reported in it.
 */
class SourceOrder {
  static compare(
    a: Pick<ISourceSpan, "line" | "column">,
    b: Pick<ISourceSpan, "line" | "column">,
  ): number {
    return a.line - b.line || a.column - b.column;
  }
}

export default SourceOrder;
