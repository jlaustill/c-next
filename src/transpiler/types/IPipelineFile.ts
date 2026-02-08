import IDiscoveredFile from "../data/types/IDiscoveredFile";

/**
 * A file descriptor for the unified transpilation pipeline.
 *
 * Supports both disk-based files (from run()) and in-memory sources
 * (from transpileSource()). The pipeline reads content via:
 *   file.source ?? this.fs.readFile(file.path)
 */
interface IPipelineFile {
  /** Absolute path to the source file */
  readonly path: string;

  /** In-memory source content (overrides disk read when set) */
  readonly source?: string;

  /** The discovered file metadata (type, extension) */
  readonly discoveredFile: IDiscoveredFile;

  /** When true, collect symbols only — skip code generation */
  readonly symbolOnly?: boolean;

  /** C-Next includes for transitive enum resolution */
  readonly cnextIncludes?: ReadonlyArray<{ path: string }>;
}

export default IPipelineFile;
