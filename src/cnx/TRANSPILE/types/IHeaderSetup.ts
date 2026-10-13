import type IAnchorFacts from "../../PARSE/1-Discover/types/IAnchorFacts";
import type IFileIncludes from "../../PARSE/1-Discover/types/IFileIncludes";

/** 1.1's facts a file's header is captured from, carried to 2.3 in the plan (#1991) */
interface IHeaderSetup {
  readonly anchor: IAnchorFacts;
  readonly headerExtension: string;
  readonly includes: ReadonlyMap<string, IFileIncludes>;
  readonly ownIncludes: IFileIncludes;
}

export default IHeaderSetup;
