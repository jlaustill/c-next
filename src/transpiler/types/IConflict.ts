/**
 * Symbol conflict information for cross-language symbol detection.
 */

import ISymbol from "../../utils/types/ISymbol";

interface IConflict {
  symbolName: string;
  definitions: ISymbol[];
  severity: "error" | "warning";
  message: string;
}

export default IConflict;
