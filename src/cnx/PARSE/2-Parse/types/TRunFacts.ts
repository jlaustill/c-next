import type ISourceGraph from "../../1-Discover/types/ISourceGraph";
import type IFileIncludes from "../../1-Discover/types/IFileIncludes";
import type IOutputPaths from "../../1-Discover/types/IOutputPaths";
import type IHeaderMacroDump from "./IHeaderMacroDump";

/**
 * The run's facts the passes after 1.2 read: 1.1's anchor and settings, and
 * what 1.2 settled from the headers it read with the target's compiler
 * (#1713) -- the run's mode, that mode's include spellings and output paths,
 * and each cnx file's header macro dump.
 */
type TRunFacts = Pick<ISourceGraph, "anchor" | "run"> & {
  readonly cppMode: boolean;
  readonly includes: ReadonlyMap<string, IFileIncludes>;
  readonly outputs: ReadonlyMap<string, IOutputPaths>;
  readonly headerMacroDumps: ReadonlyMap<string, IHeaderMacroDump>;
};

export default TRunFacts;
