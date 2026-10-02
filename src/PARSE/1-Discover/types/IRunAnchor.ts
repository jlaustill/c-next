import type PathResolver from "../PathResolver";
import type Preprocessor from "../preprocessor/Preprocessor";

/**
 * Where a run is anchored (#1719): every fact that follows from the location of
 * the run's own root, rather than from anything one file says.
 *
 * A files run is anchored at its `input`; a source run where its text lives.
 * These were derived once, from `config.input`, when the class was built -- and
 * the editor builds it with an empty `input`, so its preview was anchored at
 * the parent of the process's cwd: its `#include`s and guards changed with the
 * cwd, and it never read the project's `compile_commands.json`.
 */
interface IRunAnchor {
  /** The anchor, resolved: the input, or where the source run's text lives. */
  readonly path: string;

  /**
   * The directory a `.cnx` header's `#include` is measured from, and the
   * include guard's base when no project root is found.
   */
  readonly directory: string;

  /** The project root found by walking up from the anchor, if any. */
  readonly projectRoot: string | undefined;

  /** The caller's include directories, then the compile database's. */
  readonly includeDirs: readonly string[];

  /** The compile database's defines beneath the caller's, which win. */
  readonly defines: Readonly<Record<string, string | boolean>>;

  /** The compiler the compile database names, which picks the toolchain. */
  readonly compiler: string | null;

  readonly preprocessor: Preprocessor;

  readonly pathResolver: PathResolver;
}

export default IRunAnchor;
