/**
 * Context object holding shared state for symbol collection
 */

import ISymbol from "../../types/ISymbol";
import SymbolTable from "../SymbolTable";

interface ICollectorContext {
  /** Source file path being parsed */
  sourceFile: string;
  /** Collected symbols */
  symbols: ISymbol[];
  /** Warnings generated during collection */
  warnings: string[];
  /** Optional symbol table for struct field registration */
  symbolTable: SymbolTable | null;
}

export default ICollectorContext;
