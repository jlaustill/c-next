/** Which ADR-037 preprocessor directive shape the parser matched */
type TDirectiveKind =
  | "define-function"
  | "define-value"
  | "define-flag"
  | "define-other"
  | "conditional"
  | "none";

export default TDirectiveKind;
