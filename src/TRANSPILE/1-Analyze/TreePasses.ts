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
import HeaderParser from "../../PARSE/2-Parse/HeaderParser";
import EHeaderLanguage from "../../PARSE/1-Discover/types/EHeaderLanguage";
import type IHeaderSource from "../../PARSE/1-Discover/types/IHeaderSource";
import type IRecoveredSlice from "../../PARSE/1-Discover/types/IRecoveredSlice";
import CResolver from "../../PARSE/3-Declare/c/index";
import HeaderDeclarations from "../../PARSE/3-Declare/HeaderDeclarations";
import SymbolRegistry from "../../PARSE/3-Declare/SymbolRegistry";
import SymbolTable from "../../PARSE/3-Declare/SymbolTable";
import type IFileSymbols from "../../types/IFileSymbols";
import invariant from "../../utils/invariant";
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

  /**
   * One header from 1.1, through 1.2 into 1.3: its symbols written to the
   * run's table, its tree a local here (#1932).
   */
  static declareHeader(
    path: string,
    source: IHeaderSource,
    symbolTable: SymbolTable,
  ): void {
    HeaderDeclarations.declare(HeaderParser.parse(source), path, symbolTable);
  }

  /**
   * Issue #985: 1.1's recovered slices (#1279), each parsed by 1.2 and
   * declared by 1.3, and a clean per-slice C parse for
   * `HeaderDeclarations.clearPhantomStructBodies`, which this returns.
   */
  static recoverDeclarations(
    slices: ReadonlyMap<string, IRecoveredSlice>,
    symbolTable: SymbolTable,
  ): SymbolTable {
    const cleanState = new SymbolTable();
    for (const [path, slice] of slices) {
      HeaderDeclarations.recoverSlice(
        path,
        HeaderParser.parse(slice),
        HeaderParser.parseC(slice.text).tree,
        symbolTable,
        cleanState,
      );
    }
    return cleanState;
  }

  /**
   * One C-Next file from 1.1, through 1.2 into 1.3, for a caller with no run
   * (`lib/parseWithSymbols`). Unlike `run`, a parse error does not stop it:
   * the editor's symbol list is read while the text is mid-edit, so it is
   * declared from the repaired tree and the errors travel beside the symbols.
   */
  static declareFile(
    file: IPipelineFile,
    registry: SymbolRegistry,
  ): { symbols: IFileSymbols; parseErrors: readonly ITranspileError[] } {
    const parsed = CNextSourceParser.parse(file.source);
    return {
      symbols: CNextResolver.resolve(parsed.tree, file.path, registry),
      parseErrors: parsed.parseErrors,
    };
  }

  /**
   * One C header from 1.1, through 1.2 into 1.3, resolved on its own for a
   * caller with no run (`lib/parseCHeader`); null when it cannot be parsed.
   */
  static resolveCHeader(
    source: IHeaderSource,
    path: string,
  ): ReturnType<typeof CResolver.resolve> | null {
    invariant(
      source.language === EHeaderLanguage.C,
      `resolveCHeader reads a C header, not ${source.language}`,
    );
    const { tree } = HeaderParser.parseC(source.text);
    return tree ? CResolver.resolve(tree, path) : null;
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
      return runAnalyzers(parsed, inputs());
    } catch (err) {
      return [CaughtError.asTranspileError(err)];
    }
  }
}

export default TreePasses;
