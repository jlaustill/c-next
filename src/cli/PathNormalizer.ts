/**
 * PathNormalizer
 * Centralized path normalization for all config paths.
 * Handles tilde expansion and recursive directory search.
 */

import { join } from "node:path";
import IFileSystem from "../transpiler/types/IFileSystem";
import NodeFileSystem from "../transpiler/NodeFileSystem";
import ICliConfig from "./types/ICliConfig";

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

  /**
   * Normalize a single path (tilde expansion only).
   * Used for output, headerOut, basePath.
   * @param path - Path to normalize
   * @returns Normalized path
   */
  static normalizePath(path: string): string {
    if (!path) {
      return path;
    }
    return this.expandTilde(path);
  }

  /**
   * Normalize include paths (tilde + recursive expansion).
   * @param paths - Array of paths to normalize
   * @param fs - File system abstraction for testing
   * @returns Flattened array of all resolved directories
   */
  static normalizeIncludePaths(
    paths: string[],
    fs: IFileSystem = defaultFs,
  ): string[] {
    const result: string[] = [];

    for (const path of paths) {
      const expanded = this.expandTilde(path);
      const dirs = this.expandRecursive(expanded, fs);
      result.push(...dirs);
    }

    return result;
  }

  /**
   * Normalize all paths in a CLI config.
   * Single entry point for all path normalization.
   * @param config - CLI config with potentially unnormalized paths
   * @param fs - File system abstraction for testing
   * @returns New config with all paths normalized
   */
  static normalizeConfig(
    config: ICliConfig,
    fs: IFileSystem = defaultFs,
  ): ICliConfig {
    return {
      ...config,
      outputPath: this.normalizePath(config.outputPath),
      headerOutDir: config.headerOutDir
        ? this.normalizePath(config.headerOutDir)
        : undefined,
      basePath: config.basePath
        ? this.normalizePath(config.basePath)
        : undefined,
      includeDirs: this.normalizeIncludePaths(config.includeDirs, fs),
    };
  }
}

export default PathNormalizer;
