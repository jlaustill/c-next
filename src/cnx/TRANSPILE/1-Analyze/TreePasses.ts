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
import CResolver from "../../PARSE/3-Declare/c/index";
import SymbolRegistry from "../../PARSE/3-Declare/SymbolRegistry";
import type IFileSymbols from "../../types/IFileSymbols";
import invariant from "../../utils/invariant";
import CnxResolver from "../../PARSE/3-Declare/cnx/index";
import type IPipelineFile from "../../PARSE/1-Discover/types/IPipelineFile";
import type ITranspileError from "../../types/ITranspileError";

class TreePasses {
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
      symbols: CnxResolver.resolve(parsed.program, file.path, registry),
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
