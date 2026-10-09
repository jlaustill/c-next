import type IPipelineFile from "../../../PARSE/1-Discover/types/IPipelineFile";
import type SymbolRegistry from "../../../PARSE/3-Declare/SymbolRegistry";
import type IAnalyzerOptions from "./IAnalyzerOptions";
import type IDeclaredSource from "./IDeclaredSource";

/**
 * What the host supplies to `TreePasses.run`: everything 1.3 and 2.1 need
 * that is not a parse tree. Every member takes and returns plain data, so the
 * host never receives a tree (#1932).
 */
interface ITreePassesHost {
  /** The run's scope graph 1.3 Declare writes into (#1452) */
  readonly registry: SymbolRegistry;

  /**
   * 1.4 Resolve and the whole-program checks, over every declared file.
   * Records its own errors; `false` ends the run before 2.1.
   */
  resolve(declared: readonly IDeclaredSource[]): boolean;

  /**
   * One file's 2.1 inputs, established per file just before its analyzers
   * run. `null` in parse-only mode, which analyzes nothing.
   */
  readonly analysisInputs: ((file: IPipelineFile) => IAnalyzerOptions) | null;
}

export default ITreePassesHost;
