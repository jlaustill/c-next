/**
 * 1.3 Declare over 1.2's artifact (#1991): each parsed C-Next file's symbols,
 * with its syntax carried forward for 1.4 and 2.1.
 */
import type IParsedSource from "../2-Parse/types/IParsedSource";
import type ITranspileError from "../../types/ITranspileError";
import CaughtError from "../../utils/CaughtError";
import CNextResolver from "./cnext/index";
import type SymbolRegistry from "./SymbolRegistry";
import type IDeclaredSource from "./types/IDeclaredSource";

class Declare {
  /** Each file 1.3 declared, and the errors of any it could not */
  static sources(
    parsed: readonly IParsedSource[],
    registry: SymbolRegistry,
  ): {
    readonly declared: readonly IDeclaredSource[];
    readonly errors: readonly ITranspileError[];
  } {
    const declared: IDeclaredSource[] = [];
    const errors: ITranspileError[] = [];
    for (const { file, syntax } of parsed) {
      try {
        declared.push({
          file,
          fileSymbols: CNextResolver.resolve(
            syntax.program,
            file.path,
            registry,
          ),
          syntax,
        });
      } catch (err) {
        errors.push(CaughtError.asTranspileError(err));
      }
    }
    return { declared, errors };
  }
}

export default Declare;
