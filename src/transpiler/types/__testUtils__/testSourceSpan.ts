import type ISourceSpan from "../ISourceSpan";

/**
 * Span builder for symbol mocks.
 *
 * Symbols carry a four-integer span rather than a bare line (#1318), and almost
 * every test that builds one cares about the line alone -- it is asserting which
 * declaration a diagnostic names, not how wide it is. Spelling the other three
 * fields at each site would bury that intent in noise, and a `as never` cast to
 * dodge them is what let mocks drift from the interface before (see
 * `testTypeAccessors`).
 *
 * Defaults to a zero-width span at the start of the line. A test that asserts a
 * column or a range passes them explicitly.
 */
class TestSourceSpan {
  static at(
    line: number,
    column = 0,
    endLine?: number,
    endColumn?: number,
  ): ISourceSpan {
    return {
      line,
      column,
      endLine: endLine ?? line,
      endColumn: endColumn ?? column,
    };
  }
}

export default TestSourceSpan;
