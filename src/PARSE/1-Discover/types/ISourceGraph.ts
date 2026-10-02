import type IDiscoveredFile from "../../../transpiler/data/types/IDiscoveredFile";
import type IPipelineFile from "../../../transpiler/types/IPipelineFile";
import type IRunAnchor from "../../../transpiler/types/IRunAnchor";
import type IFileIncludes from "./IFileIncludes";

/**
 * `SourceGraph` — the artifact 1.1 Discover emits (#1444).
 *
 * `docs/architecture/README.md` §1 gives 1.1 sole authorship of which files
 * exist, their kind, the include graph, topological order and every resolved
 * absolute path. Before this, those facts were the pipeline's input record plus
 * five maps `Transpiler` accumulated beside it, and 1.4's `Program` carried
 * four of them for want of a 1.1 artifact (#1452).
 *
 * Plain data, frozen when discovery ends: the record, its arrays and each
 * file's records are `Object.freeze`d, and its maps are typed read-only, as
 * `Program`'s are. A class would not do: immer's `freeze(x, true)` is a silent
 * no-op on class instances (#1313).
 */
interface ISourceGraph {
  /**
   * The C-Next files, in dependency order: every file after the files it
   * includes (#580). Each carries its kind, its resolved path, the text
   * discovery read it from (one read, #1835 review) and its direct `.cnx`
   * includes, which are the graph's edges (#1435).
   */
  readonly cnextFiles: readonly IPipelineFile[];

  /** The C and C++ headers the files reach, transitively. */
  readonly headerFiles: readonly IDiscoveredFile[];

  /**
   * Per header (by `path`), the search path discovery resolved it along --
   * that of the `.cnx` file that reached it (#1723). Header preprocessing and
   * the #985 translation-unit recovery take their -I list from here.
   */
  readonly headerSearchPaths: ReadonlyMap<string, readonly string[]>;

  /**
   * Every `.cnx` file's search path, merged in discovery order (#1723): the -I
   * list for preprocessing with no single includer.
   */
  readonly includeSearchPaths: readonly string[];

  /**
   * Per C-Next file, by `path`, what discovery learned about its includes.
   *
   * **The ORDER is significant** and is the order discovery VISITED the
   * files, not `cnextFiles`' dependency order: a generated header takes its
   * include spellings from every file in this order, and
   * `ExternalTypeHeaderBuilder` lets the first header declaring a type win.
   */
  readonly includes: ReadonlyMap<string, IFileIncludes>;

  /**
   * Where the run is anchored (#1719), as facts: the project root found from
   * the anchor, the directory a `.cnx` header's `#include` is measured from,
   * and the compile database's defines beneath the caller's.
   */
  readonly anchor: Pick<IRunAnchor, "directory" | "projectRoot" | "defines">;

  /** Whether to write generated output to disk: a files run, not a source run. */
  readonly writeOutputToDisk: boolean;
}

export default ISourceGraph;
