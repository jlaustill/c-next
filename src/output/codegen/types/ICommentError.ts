/**
 * MISRA C:2012 comment violation (ADR-043)
 */
interface ICommentError {
  /** MISRA rule violated */
  rule: "3.1" | "3.2";
  /** Error message */
  message: string;
  /** Line number (1-based) */
  line: number;
  /** Column (0-based) */
  column: number;
}

export default ICommentError;
