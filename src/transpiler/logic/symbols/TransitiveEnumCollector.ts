/**
 * TransitiveEnumCollector
 * Issue #588: Extracted from Transpiler to logic layer
 *
 * Collects symbol information from transitively included .cnx files.
 * This enables proper enum prefixing when enums are defined in deeply
 * nested includes (A includes B, B includes C with enum).
 */

import { dirname } from "node:path";
import { readFileSync } from "node:fs";
import ICodeGenSymbols from "../../types/ICodeGenSymbols";
import IncludeResolver from "../../data/IncludeResolver";

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
    const visited = new Set<string>();

    TransitiveEnumCollector.collectRecursively(
      filePath,
      symbolInfoByFile,
      includeDirs,
      visited,
      result,
    );

    return result;
  }

  /**
   * Internal recursive collection helper.
   *
   * @param currentPath - Current file being processed
   * @param symbolInfoByFile - Map of file paths to their symbol info
   * @param includeDirs - Additional directories to search for includes
   * @param visited - Set of already-visited file paths
   * @param result - Accumulator for collected symbol info
   */
  private static collectRecursively(
    currentPath: string,
    symbolInfoByFile: ReadonlyMap<string, ICodeGenSymbols>,
    includeDirs: readonly string[],
    visited: Set<string>,
    result: ICodeGenSymbols[],
  ): void {
    if (visited.has(currentPath)) return;
    visited.add(currentPath);

    // Read and parse includes from current file
    let content: string;
    try {
      content = readFileSync(currentPath, "utf-8");
    } catch {
      // File doesn't exist or can't be read - skip
      return;
    }

    const searchPaths = IncludeResolver.buildSearchPaths(
      dirname(currentPath),
      [...includeDirs],
      [],
    );
    const resolver = new IncludeResolver(searchPaths);
    const resolved = resolver.resolve(content, currentPath);

    // Process each included .cnx file
    for (const cnxInclude of resolved.cnextIncludes) {
      const externalInfo = symbolInfoByFile.get(cnxInclude.path);
      if (externalInfo) {
        result.push(externalInfo);
      }
      // Recursively collect from this include's includes
      TransitiveEnumCollector.collectRecursively(
        cnxInclude.path,
        symbolInfoByFile,
        includeDirs,
        visited,
        result,
      );
    }
  }
}

export default TransitiveEnumCollector;
