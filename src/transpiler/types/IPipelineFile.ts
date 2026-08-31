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

  /**
   * Whether this file can see a C/C++ header, directly or through any `.cnx`
   * it includes.
   *
   * #1399 review: E0426/E0427 may only fire where the transpiler knows the
   * file's whole name universe. A header is not parsed into the symbol table
   * and a `#define` never reaches it at all, so a file that can see one must
   * decline to answer. Computed from the resolver's own categorization during
   * discovery, which is the authoritative answer -- deriving it from `#include`
   * token text in the analyzer made a third spelling of "is this a C-Next
   * include?" and that spelling missed `.cnext`.
   */
  readonly reachesForeignHeader?: boolean;

  /** Override for source-relative path (used in source mode) */
  readonly sourceRelativePath?: string;
}

export default IPipelineFile;
