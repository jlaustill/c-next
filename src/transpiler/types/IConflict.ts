/**
 * Symbol conflict information for cross-language symbol detection.
 */

import TAnySymbol from "./symbols/TAnySymbol";

interface IConflict {
  symbolName: string;
  definitions: TAnySymbol[];
  severity: "error" | "warning";
  message: string;
}

export default IConflict;
