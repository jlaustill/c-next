import ISymbol from "../../types/ISymbol";

/**
 * Represents a symbol conflict between languages
 */
interface IConflict {
  /** The conflicting symbol name */
  symbolName: string;

  /** All definitions of this symbol */
  definitions: ISymbol[];

  /** Conflict severity */
  severity: "error" | "warning";

  /** Human-readable message */
  message: string;
}

export default IConflict;
