import IDiscoveredFile from "../data/types/IDiscoveredFile";

/**
 * A file descriptor for the unified transpilation pipeline.
 *
 * Supports both disk-based files (kind: 'files') and in-memory sources
 * (kind: 'source'). The pipeline reads content via:
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

  /** Override for source-relative path (used in source mode) */
  readonly sourceRelativePath?: string;
}

export default IPipelineFile;
