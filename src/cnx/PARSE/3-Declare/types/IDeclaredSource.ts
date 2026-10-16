import type IPipelineFile from "../../1-Discover/types/IPipelineFile";
import type IFileSymbols from "../../../types/IFileSymbols";
import type ISourceSyntax from "../../../types/ISourceSyntax";

/** 1.3's artifact for one C-Next file, which 1.4 resolves (#1991) */
interface IDeclaredSource {
  readonly file: IPipelineFile;
  readonly fileSymbols: IFileSymbols;
  /** 1.2's syntax, carried through 1.3 to 2.1 (#1991) */
  readonly syntax: ISourceSyntax;
}

export default IDeclaredSource;
