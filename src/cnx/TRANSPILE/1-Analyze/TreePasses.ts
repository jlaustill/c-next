/**
 * Header text from 1.1 through 1.2 into 1.3, and the `lib/` entry points'
 * one-file versions of 1.2 and 1.3, each run as one call so that every tree
 * stays a local here and plain data comes out (#1932).
 *
 * The run's C-Next files go through `Parse`, `Declare` and `Analyze` instead,
 * which the host chains one pass at a time (#1991).
 */
import SourceSyntax from "../../PARSE/2-Parse/SourceSyntax";
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
import type ITranspileError from "../../types/ITranspileError";

class TreePasses {
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
        HeaderParser.parseC(slice.text).syntax,
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
    const parsed = SourceSyntax.of(file.source);
    return {
      symbols: CNextResolver.resolve(parsed.program, file.path, registry),
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
    const { syntax } = HeaderParser.parseC(source.text);
    return syntax ? CResolver.resolve(syntax, path) : null;
  }
}

export default TreePasses;
