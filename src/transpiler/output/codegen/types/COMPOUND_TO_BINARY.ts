/**
 * Map compound assignment operator to its binary operator equivalent.
 *
 * Shared constant used by:
 * - SimpleHandler.ts: MISRA 10.3 compound assignment expansion
 * - AtomicGenerator.ts: Atomic compound operation expansion
 */
const COMPOUND_TO_BINARY: Record<string, string> = {
  "+=": "+",
  "-=": "-",
  "*=": "*",
  "/=": "/",
  "%=": "%",
  "&=": "&",
  "|=": "|",
  "^=": "^",
  "<<=": "<<",
  ">>=": ">>",
};

export default COMPOUND_TO_BINARY;
