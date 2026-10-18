/**
 * A source position for the scope-context matrix to classify. A diagnostic
 * carries its column, which is what can place it inside a `for` header's
 * declaration; a provenance site has only a line, so it stays in the row of
 * the declaration enclosing that line (#1646).
 */
interface ISourcePosition {
  line: number;
  column?: number;
}

export default ISourcePosition;
