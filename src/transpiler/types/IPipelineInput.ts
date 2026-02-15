import IDiscoveredFile from "../data/types/IDiscoveredFile";
import IPipelineFile from "./IPipelineFile";

/**
 * Input to the unified transpilation pipeline (_executePipeline).
 *
 * Both run() and transpileSource() construct this and delegate to the pipeline.
 */
interface IPipelineInput {
  /** C-Next files to process (in dependency order) */
  readonly cnextFiles: IPipelineFile[];

  /** C/C++ header files for symbol collection */
  readonly headerFiles: IDiscoveredFile[];

  /** Whether to write generated output to disk */
  readonly writeOutputToDisk: boolean;
}

export default IPipelineInput;
