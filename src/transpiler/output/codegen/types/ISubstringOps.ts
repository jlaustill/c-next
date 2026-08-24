/**
 * Operands of a substring extraction, as generated C expressions.
 *
 * Every field except sourceCapacity holds generated code, not a value:
 * `myStr[0, 5]` yields source "myStr", start "0", lengthExpression "5".
 *
 * Extracted here because IOrchestrator and CodeGenerator each wrote this shape
 * out inline, so the same four fields were declared in four places and any
 * change to one of them needed four edits.
 */
interface ISubstringOps {
  /** Generated C expression for the source string */
  source: string;
  /** Generated C expression for the start offset */
  start: string;
  /**
   * Generated C expression for the length.
   *
   * Named lengthExpression rather than length because it holds code, not a
   * count -- it can read "5" or "generated_len". Calling it `length` shadowed
   * the built-in collection-size meaning, which made assertions on it look
   * like assertions about a collection (SonarCloud S5906).
   */
  lengthExpression: string;
  /** Capacity of the source string in bytes, known at compile time */
  sourceCapacity: number;
}

export default ISubstringOps;
