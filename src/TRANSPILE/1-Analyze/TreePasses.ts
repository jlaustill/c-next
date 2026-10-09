/**
 * 1.2 Parse through 2.1 Analyze: the only passes that read a parse tree, run
 * as one call (#1932, owner ruling 2026-10-09).
 *
 * Every tree is a local of `run` and dies when it returns. The host gets plain
 * data in, through `ITreePassesHost`, and plain data out, through
 * `TTreePassesResult`, so nothing that orchestrates the run ever holds a tree.
 * That is what lets `parse-tree-confined-to-parser` name no host.
 *
 * The order is the pipeline's, unchanged: parse and declare every file, then
 * the host resolves the whole program (1.4 needs every file declared first),
 * then 2.1 analyzes every file before any is planned (#1320).
 */
import CNextSourceParser from "../../PARSE/2-Parse/CNextSourceParser";
import CNextResolver from "../../PARSE/3-Declare/cnext/index";
import type IPipelineFile from "../../PARSE/1-Discover/types/IPipelineFile";
import type IAnalyzedFile from "../../types/IAnalyzedFile";
import type IParsedFile from "../../types/IParsedFile";
import type ITranspileError from "../../types/ITranspileError";
import CaughtError from "../../utils/CaughtError";
import Diagnostics from "./Diagnostics";
import runAnalyzers from "./runAnalyzers";
import type IAnalyzerOptions from "./types/IAnalyzerOptions";
import type IDeclaredSource from "./types/IDeclaredSource";
import type ITreePassesHost from "./types/ITreePassesHost";
import type TTreePassesResult from "./types/TTreePassesResult";

class TreePasses {
  static run(
    files: readonly IPipelineFile[],
    host: ITreePassesHost,
  ): TTreePassesResult {
    const errors: ITranspileError[] = [];
    const declared: IDeclaredSource[] = [];
    // Only files that produce output are analyzed and planned. A symbol-only
    // file is still parsed, declared and resolved -- that is why it was
    // discovered -- but nothing reads its tree after 1.3.
    const parses: { file: IPipelineFile; parsed: IParsedFile }[] = [];

    for (const file of files) {
      const parsed = CNextSourceParser.parse(file.source);
      // #1445: 1.2 carries its own errors; this stamps the path the text
      // came from, the one fact 1.2 cannot know because it parses a string.
      if (parsed.parseErrors.length > 0) {
        errors.push(
          ...parsed.parseErrors.map((e) => ({ ...e, sourcePath: file.path })),
        );
        continue;
      }
      try {
        declared.push({
          file,
          fileSymbols: CNextResolver.resolve(
            parsed.tree,
            file.path,
            host.registry,
          ),
          targetDirectives: parsed.targetDirectives,
        });
      } catch (err) {
        errors.push(CaughtError.asTranspileError(err));
        continue;
      }
      if (TreePasses.producesOutput(file)) {
        parses.push({ file, parsed });
      }
    }

    if (errors.length > 0) {
      return { kind: "stopped", errors };
    }
    if (!host.resolve(declared)) {
      return { kind: "stopped", errors: [] };
    }

    const analysisInputs = host.analysisInputs;
    const byFile = new Map<string, readonly ITranspileError[]>();
    const analyzed = new Map<string, IAnalyzedFile>();
    for (const entry of parses) {
      if (analysisInputs) {
        byFile.set(
          entry.file.path,
          TreePasses._analyze(entry.parsed, () => analysisInputs(entry.file)),
        );
      }
      analyzed.set(entry.file.path, {
        program: entry.parsed.program,
        declarationCount: entry.parsed.declarationCount,
      });
    }

    return {
      kind: "analyzed",
      diagnostics: Diagnostics.build(byFile),
      files: analyzed,
    };
  }

  /** True for a file the run analyzes, plans and writes, not only declares */
  static producesOutput(file: IPipelineFile): boolean {
    return !file.symbolOnly;
  }

  private static _analyze(
    parsed: IParsedFile,
    inputs: () => IAnalyzerOptions,
  ): readonly ITranspileError[] {
    try {
      return runAnalyzers(parsed.tree, parsed.comments, inputs());
    } catch (err) {
      return [CaughtError.asTranspileError(err)];
    }
  }
}

export default TreePasses;
