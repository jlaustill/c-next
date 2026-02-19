/**
 * PathNormalizer
 * Centralized path normalization for all config paths.
 * Handles tilde expansion and recursive directory search.
 */

import { join } from "node:path";
import IFileSystem from "../transpiler/types/IFileSystem";
import NodeFileSystem from "../transpiler/NodeFileSystem";

/** Default file system instance */
const defaultFs = NodeFileSystem.instance;

class PathNormalizer {
  /**
   * Expand ~ at the start of a path to the home directory.
   * Only expands leading tilde (~/path or bare ~).
   * @param path - Path that may start with ~
   * @returns Path with ~ expanded to home directory
   */
  static expandTilde(path: string): string {
    if (!path.startsWith("~")) {
      return path;
    }

    const home = process.env.HOME || process.env.USERPROFILE;
    if (!home) {
      return path;
    }

    if (path === "~") {
      return home;
    }

    if (path.startsWith("~/")) {
      return home + path.slice(1);
    }

    return path;
  }

  /**
   * Expand path/** to include all subdirectories recursively.
   * If path doesn't end with /**, returns the path as single-element array
   * (if it exists) or empty array (if it doesn't exist).
   * @param path - Path that may end with /**
   * @param fs - File system abstraction for testing
   * @returns Array of all directories found
   */
  static expandRecursive(path: string, fs: IFileSystem = defaultFs): string[] {
    const hasRecursiveSuffix = path.endsWith("/**");
    const basePath = hasRecursiveSuffix ? path.slice(0, -3) : path;

    if (!fs.exists(basePath)) {
      return [];
    }

    if (!fs.isDirectory(basePath)) {
      return [basePath];
    }

    if (!hasRecursiveSuffix) {
      return [basePath];
    }

    // Recursively collect all subdirectories
    const dirs: string[] = [basePath];
    this.collectSubdirectories(basePath, dirs, fs);
    return dirs;
  }

  /**
   * Recursively collect all subdirectories into the dirs array.
   */
  private static collectSubdirectories(
    dir: string,
    dirs: string[],
    fs: IFileSystem,
  ): void {
    const entries = fs.readdir(dir);
    for (const entry of entries) {
      const fullPath = join(dir, entry);
      if (fs.isDirectory(fullPath)) {
        dirs.push(fullPath);
        this.collectSubdirectories(fullPath, dirs, fs);
      }
    }
  }
}

export default PathNormalizer;
