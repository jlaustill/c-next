/** Which token a literal was written as: the grammar's `literal` alternatives */
type TLiteralKind =
  | "suffixedDecimal"
  | "suffixedHex"
  | "suffixedBinary"
  | "suffixedFloat"
  | "integer"
  | "hex"
  | "binary"
  | "float"
  | "string"
  | "char"
  | "true"
  | "false"
  | "null";

export default TLiteralKind;
