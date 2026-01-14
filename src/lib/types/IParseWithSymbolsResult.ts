import ITranspileError from "./ITranspileError";
import ISymbolInfo from "./ISymbolInfo";

/**
 * Result of parsing with symbol extraction
 */
interface IParseWithSymbolsResult {
  /** Whether parsing succeeded without errors */
  success: boolean;
  /** List of errors and warnings */
  errors: ITranspileError[];
  /** Extracted symbols */
  symbols: ISymbolInfo[];
}

export default IParseWithSymbolsResult;
