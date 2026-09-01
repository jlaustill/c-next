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

  /** Whether to write generated output to disk */
  readonly writeOutputToDisk: boolean;

  /**
   * SPIKE #1431 -- THROWAWAY, removed before the findings doc lands.
   *
   * The include edges, carried forward from discovery instead of discarded.
   *
   * They exist today only inside `_buildPipelineInput`, where `DependencyGraph` is a
   * LOCAL that dies when discovery flattens it to a sorted list. `IPipelineFile.
   * cnextIncludes` is set in source mode and NOT in files mode, so the probe could
   * not derive the closure on the normal CLI path at all -- `includeEdges` came back
   * empty and the identity control failed, which is how this was found.
   *
   * Carried here rather than re-derived: writing a third implementation of "what does
   * this file include" to measure the first two would make the measurement a party to
   * the defect it is measuring.
   */
  readonly spikeIncludeEdges?: ReadonlyArray<{
    readonly dependent: string;
    readonly dependency: string;
  }>;
}

export default IPipelineInput;
