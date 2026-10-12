import type IPipelineFile from "../../../PARSE/1-Discover/types/IPipelineFile";
import type IFileSymbols from "../../../types/IFileSymbols";
import type ISourceSyntax from "../../../types/ISourceSyntax";

/**
 * What `TreePasses` hands the host for 1.4 Resolve: one declared file, as
 * plain data. The tree it was declared from stays inside `TreePasses` (#1932).
 */
interface IDeclaredSource {
  readonly file: IPipelineFile;
  readonly fileSymbols: IFileSymbols;
  /** 1.2's syntax, carried through 1.3 to 1.4 (`targetDirectives`) and 2.1 (#1991) */
  readonly syntax: ISourceSyntax;
}

export default IDeclaredSource;
