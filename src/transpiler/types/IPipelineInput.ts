import IDiscoveredFile from "../data/types/IDiscoveredFile";
import IPipelineFile from "./IPipelineFile";

/**
 * Input to the unified transpilation pipeline (_executePipeline).
 *
 * transpile() constructs this via discoverIncludes() and delegates to the pipeline.
 */
interface IPipelineInput {
  /** C-Next files to process (in dependency order) */
  readonly cnextFiles: IPipelineFile[];

  /** C/C++ header files for symbol collection */
  readonly headerFiles: IDiscoveredFile[];

  /**
   * Per header (by `path`), the search path discovery resolved it along --
   * that of the `.cnx` file that reached it (#1723). Header preprocessing and
   * the #985 translation-unit recovery take their -I list from here, so a
   * header is preprocessed along the path it was found on.
   */
  readonly headerSearchPaths: ReadonlyMap<string, readonly string[]>;

  /**
   * Every `.cnx` file's search path, merged in discovery order (#1723): the -I
   * list for preprocessing with no single includer -- the #985 translation
   * unit made of all the run's C includes, quoted ones included.
   */
  readonly includeSearchPaths: readonly string[];

  /** Whether to write generated output to disk */
  readonly writeOutputToDisk: boolean;
}

export default IPipelineInput;
