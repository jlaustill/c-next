import type PathResolver from "../PathResolver";
import type Preprocessor from "../preprocessor/Preprocessor";
import type IAnchorFacts from "./IAnchorFacts";

/**
 * Where a run is anchored (#1719): every fact that follows from the location of
 * the run's own root, rather than from anything one file says.
 *
 * A files run is anchored at its `input`; a source run where its text lives.
 * These were derived once, from `config.input`, when the class was built -- and
 * the editor builds it with an empty `input`, so its preview was anchored at
 * the parent of the process's cwd: its `#include`s and guards changed with the
 * cwd, and it never read the project's `compile_commands.json`.
 *
 * Its facts are `IAnchorFacts`, which the `SourceGraph` carries. What this adds
 * is what only 1.1 and the orchestrator use: the anchor's own path and include
 * directories, and the services the compile database picks.
 */
interface IRunAnchor extends IAnchorFacts {
  /** The anchor, resolved: the input, or where the source run's text lives. */
  readonly path: string;

  /** The caller's include directories, then the compile database's. */
  readonly includeDirs: readonly string[];

  /** The compiler the compile database names, which picks the toolchain. */
  readonly compiler: string | null;

  readonly preprocessor: Preprocessor;

  readonly pathResolver: PathResolver;
}

export default IRunAnchor;
