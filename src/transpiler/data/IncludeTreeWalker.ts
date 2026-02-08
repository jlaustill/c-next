/**
 * IncludeTreeWalker
 * Issue #591: Shared utility for traversing C-Next include trees
 *
 * Eliminates duplicate recursive traversal logic in:
 * - Transpiler._discoverFromSource() (standalone include discovery)
 * - TransitiveEnumCollector.collectForStandalone()
 * - TransitiveEnumCollector.collectRecursively()
 */

import { readFileSync } from "node:fs";
import { dirname } from "node:path";

import IncludeResolver from "./IncludeResolver";
import IDiscoveredFile from "./types/IDiscoveredFile";
import EFileType from "./types/EFileType";

/**
 * Callback invoked for each C-Next include file encountered during traversal.
 * @param file - The discovered include file
 * @returns false to stop traversal of this branch, true/void to continue
 */
type TWalkCallback = (file: IDiscoveredFile) => boolean | void;

/**
 * Walks the C-Next include tree, invoking a callback for each file.
 *
 * Handles:
 * - Cycle detection (files are visited only once)
 * - Recursive include resolution
 * - Error handling for unreadable files
 */
class IncludeTreeWalker {
  /**
   * Walk the include tree starting from a list of includes.
   *
   * @param includes - Initial list of include files to process
   * @param includeDirs - Directories to search for nested includes
   * @param callback - Function called for each include file
   * @param visited - Optional set of already-visited paths (for external tracking)
   */
  static walk(
    includes: ReadonlyArray<{ path: string }>,
    includeDirs: readonly string[],
    callback: TWalkCallback,
    visited: Set<string> = new Set(),
  ): void {
    for (const include of includes) {
      IncludeTreeWalker.walkRecursively(
        include.path,
        includeDirs,
        callback,
        visited,
      );
    }
  }

  /**
   * Walk the include tree starting from a single file path.
   *
   * @param filePath - Path to start walking from
   * @param includeDirs - Directories to search for nested includes
   * @param callback - Function called for each include file
   * @param visited - Optional set of already-visited paths
   */
  static walkFromFile(
    filePath: string,
    includeDirs: readonly string[],
    callback: TWalkCallback,
    visited: Set<string> = new Set(),
  ): void {
    // Don't call callback for the root file, just its includes
    if (visited.has(filePath)) return;
    visited.add(filePath);

    const nestedIncludes = IncludeTreeWalker.resolveIncludes(
      filePath,
      includeDirs,
    );
    if (nestedIncludes) {
      IncludeTreeWalker.walk(nestedIncludes, includeDirs, callback, visited);
    }
  }

  /**
   * Internal recursive walker.
   */
  private static walkRecursively(
    filePath: string,
    includeDirs: readonly string[],
    callback: TWalkCallback,
    visited: Set<string>,
  ): void {
    if (visited.has(filePath)) return;
    visited.add(filePath);

    // Create a minimal IDiscoveredFile for the callback
    const file: IDiscoveredFile = {
      path: filePath,
      type: EFileType.CNext,
      extension: ".cnx",
    };

    // Invoke callback - if it returns false, stop this branch
    const result = callback(file);
    if (result === false) return;

    // Resolve and walk nested includes
    const nestedIncludes = IncludeTreeWalker.resolveIncludes(
      filePath,
      includeDirs,
    );
    if (nestedIncludes) {
      for (const nested of nestedIncludes) {
        IncludeTreeWalker.walkRecursively(
          nested.path,
          includeDirs,
          callback,
          visited,
        );
      }
    }
  }

  /**
   * Resolve includes from a file path.
   * @returns Array of C-Next includes, or null if file can't be read
   */
  private static resolveIncludes(
    filePath: string,
    includeDirs: readonly string[],
  ): IDiscoveredFile[] | null {
    let content: string;
    try {
      content = readFileSync(filePath, "utf-8");
    } catch {
      return null;
    }

    const searchPaths = IncludeResolver.buildSearchPaths(
      dirname(filePath),
      [...includeDirs],
      [],
    );
    const resolver = new IncludeResolver(searchPaths);
    const resolved = resolver.resolve(content, filePath);

    return resolved.cnextIncludes;
  }
}

export default IncludeTreeWalker;
