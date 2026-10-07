import IDiscoveredFile from "./IDiscoveredFile";

/**
 * A C/C++ header a `.cnx` file includes, with that file's search path (#1723).
 *
 * The header's own `#include`s, and every header they reach, are resolved
 * along the same path -- the one discovery built for the `.cnx` file,
 * discovered tiers included -- as a compiler applies one `-I` list to a whole
 * translation unit.
 */
interface IHeaderRoot {
  readonly file: IDiscoveredFile;
  readonly searchPaths: readonly string[];
}

export default IHeaderRoot;
