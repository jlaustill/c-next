/**
 * 2.1 Analyze over 1.4's artifact (#1991): the files 1.3 declared, which 1.4
 * carried on, against the program 1.4 resolved. The program goes on to 2.2.
 * Every file is analyzed before 2.2 plans any of them (#1320).
 */
import type IPipelineFile from "../../PARSE/1-Discover/types/IPipelineFile";
import type IDeclaredSource from "../../PARSE/3-Declare/types/IDeclaredSource";
import type IAnalyzedFile from "../../types/IAnalyzedFile";
import type IDiagnostics from "../../types/IDiagnostics";
import type IProgram from "../../types/IProgram";
import type ISourceSyntax from "../../types/ISourceSyntax";
import type ITranspileError from "../../types/ITranspileError";
import CaughtError from "../../utils/CaughtError";
import Diagnostics from "./Diagnostics";
import runAnalyzers from "./runAnalyzers";
import type IAnalyzerOptions from "./types/IAnalyzerOptions";

class Analyze {
  /**
   * Each file that produces output, analyzed. `analysisInputs` is null in
   * parse-only mode, which analyzes nothing.
   */
  static run(
    // 1.4's artifact, `IResolvedProgram`, by its two fields: a pass after 1.4
    // may name `IProgram` and nothing in `4-Resolve/` (#1447)
    program: IProgram,
    sources: readonly IDeclaredSource[],
    analysisInputs:
      | ((file: IPipelineFile, program: IProgram) => IAnalyzerOptions)
      | null,
  ): {
    readonly program: IProgram;
    readonly diagnostics: IDiagnostics;
    readonly files: ReadonlyMap<string, IAnalyzedFile>;
  } {
    const byFile = new Map<string, readonly ITranspileError[]>();
    const files = new Map<string, IAnalyzedFile>();
    // A symbol-only file is still parsed, declared and resolved -- that is
    // why it was discovered -- but nothing reads its syntax after 1.4.
    for (const entry of sources.filter((d) => Analyze.producesOutput(d.file))) {
      if (analysisInputs) {
        byFile.set(
          entry.file.path,
          Analyze._analyze(entry.syntax, () =>
            analysisInputs(entry.file, program),
          ),
        );
      }
      files.set(entry.file.path, {
        program: entry.syntax.program,
        declarationCount: entry.syntax.declarationCount,
      });
    }
    return {
      program,
      diagnostics: Diagnostics.build(byFile),
      files,
    };
  }

  /** True for a file the run analyzes, plans and writes, not only declares */
  static producesOutput(file: IPipelineFile): boolean {
    return !file.symbolOnly;
  }

  private static _analyze(
    syntax: ISourceSyntax,
    inputs: () => IAnalyzerOptions,
  ): readonly ITranspileError[] {
    try {
      return runAnalyzers(syntax, inputs());
    } catch (err) {
      return [CaughtError.asTranspileError(err)];
    }
  }
}

export default Analyze;
