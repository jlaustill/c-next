/**
 * TransitiveEnumCollector
 * Issue #588: Extracted from Transpiler to logic layer
 *
 * Collects symbol information from transitively included .cnx files.
 * This enables proper enum prefixing when enums are defined in deeply
 * nested includes (A includes B, B includes C with enum).
 */

import ICodeGenSymbols from "../../types/ICodeGenSymbols";
import IncludeTreeWalker from "../../data/IncludeTreeWalker";

/**
 * Collects symbol information by traversing the include graph.
 *
 * When generating code, we need to know about enums defined in included files
 * so we can properly prefix enum member references. This collector walks the
 * include graph starting from a root file and gathers symbol info from all
 * transitively included .cnx files.
 */
class TransitiveEnumCollector {
  /**
   * Aggregate all known enum names from multiple symbol info sources.
   *
   * Issue #478: Enables header generation to skip forward-declaring enums
   * from included files by collecting all known enum names across all
   * processed files.
   *
   * @param symbolInfos - Iterable of ICodeGenSymbols (e.g., from symbolCollectors.values())
   * @returns Set of all known enum type names
   */
  static aggregateKnownEnums(
    symbolInfos: Iterable<ICodeGenSymbols>,
  ): Set<string> {
    const allEnums = new Set<string>();
    for (const info of symbolInfos) {
      for (const enumName of info.knownEnums) {
        allEnums.add(enumName);
      }
    }
    return allEnums;
  }

  /**
   * Collect symbol info from all transitively included .cnx files.
   *
   * Performs depth-first traversal of the include graph, collecting
   * ICodeGenSymbols from each visited file. Files are only visited once
   * to handle circular includes.
   *
   * @param filePath - The root file to start collecting from
   * @param symbolInfoByFile - Map of file paths to their symbol info
   * @param includeDirs - Additional directories to search for includes
   * @returns Array of ICodeGenSymbols from all transitively included .cnx files
   */
  static collect(
    filePath: string,
    symbolInfoByFile: ReadonlyMap<string, ICodeGenSymbols>,
    includeDirs: readonly string[],
  ): ICodeGenSymbols[] {
    const result: ICodeGenSymbols[] = [];

    // Issue #591: Use shared IncludeTreeWalker for traversal
    IncludeTreeWalker.walkFromFile(filePath, includeDirs, (file) => {
      const externalInfo = symbolInfoByFile.get(file.path);
      if (externalInfo) {
        result.push(externalInfo);
      }
    });

    return result;
  }

  /**
   * Collect symbol info for standalone mode from resolved includes.
   *
   * Issue #591: Extracted to unify enum collection across transpilation modes.
   * Unlike collect() which starts from a file path and parses it, this method
   * starts from already-resolved includes (from IncludeResolver.resolve()).
   *
   * @param cnextIncludes - Array of resolved C-Next include files
   * @param symbolInfoByFile - Map of file paths to their symbol info
   * @param includeDirs - Additional directories to search for nested includes
   * @returns Array of ICodeGenSymbols from all transitively included .cnx files
   */
  static collectForStandalone(
    cnextIncludes: ReadonlyArray<{ path: string }>,
    symbolInfoByFile: ReadonlyMap<string, ICodeGenSymbols>,
    includeDirs: readonly string[],
  ): ICodeGenSymbols[] {
    const result: ICodeGenSymbols[] = [];

    // Issue #591: Use shared IncludeTreeWalker for traversal
    IncludeTreeWalker.walk(cnextIncludes, includeDirs, (file) => {
      const externalInfo = symbolInfoByFile.get(file.path);
      if (externalInfo) {
        result.push(externalInfo);
      }
    });

    return result;
  }
}

export default TransitiveEnumCollector;
