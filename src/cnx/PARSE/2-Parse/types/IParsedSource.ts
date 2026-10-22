import type IPipelineFile from "../../1-Discover/types/IPipelineFile";
import type ISourceSyntax from "../../../types/ISourceSyntax";

/** 1.2's artifact for one cnx file: 1.1's file and its plain syntax (#1991) */
interface IParsedSource {
  readonly file: IPipelineFile;
  readonly syntax: ISourceSyntax;
}

export default IParsedSource;
