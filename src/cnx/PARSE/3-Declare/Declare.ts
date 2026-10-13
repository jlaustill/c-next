/**
 * 1.3 Declare over 1.2's artifact (#1991): each parsed C-Next file's symbols,
 * with its syntax carried forward for 1.4 and 2.1.
 */
import type IParsedSources from "../2-Parse/types/IParsedSources";
import type ITranspileError from "../../types/ITranspileError";
import CaughtError from "../../utils/CaughtError";
import CNextResolver from "./cnext/index";
import type SymbolRegistry from "./SymbolRegistry";
import type IDeclaredSource from "./types/IDeclaredSource";
import type IDeclaredSources from "./types/IDeclaredSources";

class Declare {
  /** Each file 1.3 declared, the errors of any it could not, and 1.2's carried facts */
  static sources(
    parsed: IParsedSources,
    registry: SymbolRegistry,
  ): IDeclaredSources {
    const declared: IDeclaredSource[] = [];
    const errors: ITranspileError[] = [];
    for (const { file, syntax } of parsed.sources) {
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
    return {
      declared,
      errors,
      targetCatalog: parsed.targetCatalog,
      discovery: parsed.discovery,
    };
  }
}

export default Declare;
