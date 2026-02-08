/**
 * Intermediate representation for array access operations.
 * Decouples code generation from ANTLR parser contexts.
 */
import TTypeInfo from "./TTypeInfo";

type IArrayAccessInfo = {
  /** The raw identifier name from source */
  rawName: string;
  /** The resolved name (may include dereference like `(*param)`) */
  resolvedName: string;
  /** The access type */
  accessType: "single-index" | "bit-range";
  /** Index expression as generated C code (for single-index) */
  indexExpr?: string;
  /** For bit ranges: start position */
  startExpr?: string;
  /** For bit ranges: width */
  widthExpr?: string;
  /** Type info for the variable being accessed */
  typeInfo?: TTypeInfo;
  /** Source line for error messages */
  line: number;
};

export default IArrayAccessInfo;
