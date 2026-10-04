import IDiscoveredFile from "./IDiscoveredFile";

/**
 * One C-Next file of the `SourceGraph` 1.1 Discover emits.
 *
 * A files run and a source run build the same record: discovery read every
 * file's text, or was handed the root's, and 1.2 parses exactly that.
 */
interface IPipelineFile {
  /** Absolute path to the source file */
  readonly path: string;

  /**
   * The text 1.1 Discover read for this file, or was handed for a source run's
   * root, and the text 1.2 parses. Required: one read, so a save between the
   * passes cannot give them different directives (#1835 review). #1444 review:
   * it was optional, so a later stage could still read the file again through
   * the port, and `Transpiler` did.
   */
  readonly source: string;

  /** The discovered file metadata (type, extension) */
  readonly discoveredFile: IDiscoveredFile;

  /** When true, collect symbols only — skip code generation */
  readonly symbolOnly?: boolean;

  /**
   * This file's direct `.cnx` includes, as discovery resolved them.
   *
   * #1435: required, because 1.4 Resolve takes each file's visibility closure
   * over exactly this graph. It was set in source mode only, so every file on
   * the CLI path had 1.4 re-read it from disk under a weaker search path.
   */
  readonly cnextIncludes: ReadonlyArray<{ path: string }>;

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
  readonly reachesForeignHeader: boolean;

  /** Override for source-relative path (used in source mode) */
  readonly sourceRelativePath?: string;
}

export default IPipelineFile;
