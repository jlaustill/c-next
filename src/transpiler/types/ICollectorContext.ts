/**
 * Context for C and C++ symbol collectors.
 */

import ISymbol from "../../utils/types/ISymbol";
import SymbolTable from "../logic/symbols/SymbolTable";

interface ICollectorContext {
  sourceFile: string;
  symbols: ISymbol[];
  warnings: string[];
  symbolTable: SymbolTable | null;
}

export default ICollectorContext;
