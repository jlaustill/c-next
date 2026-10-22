import type TRunFacts from "../../2-Parse/types/TRunFacts";
import type TRunTarget from "../../../types/TRunTarget";
import type ITranspileError from "../../../types/ITranspileError";
import type SymbolRegistry from "../SymbolRegistry";
import type SymbolTable from "../SymbolTable";
import type IDeclaredHeaders from "./IDeclaredHeaders";
import type IDeclaredSource from "./IDeclaredSource";

/** 1.3's artifact (#1991): each file it declared, the others' errors, and 1.2's carried facts */
interface IDeclaredSources {
  readonly declared: readonly IDeclaredSource[];
  readonly errors: readonly ITranspileError[];
  readonly target: TRunTarget;
  readonly discovery: TRunFacts;
  /**
   * #1991: the run's table, built here from the headers and every file 1.3
   * declared. 1.4 completes it; nothing after 1.4 writes to it.
   */
  readonly symbolTable: SymbolTable;
  /** #1991: the cnx functions 1.3 registered, for 1.4 */
  readonly registry: SymbolRegistry;
  readonly headers: IDeclaredHeaders;
}

export default IDeclaredSources;
