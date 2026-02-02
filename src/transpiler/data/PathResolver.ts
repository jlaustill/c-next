/**
 * PathResolver
 * Handles path calculations for output files.
 *
 * Consolidates path resolution logic used by Transpiler and CleanCommand,
 * including directory structure preservation and basePath stripping.
 */

import { existsSync, statSync, mkdirSync } from "node:fs";
import { join, basename, relative, dirname, resolve } from "node:path";

import IDiscoveredFile from "./types/IDiscoveredFile";

/**
 * Configuration for PathResolver
 */
interface IPathResolverConfig {
  /** Input files or directories */
  inputs: string[];
  /** Output directory for generated code */
  outDir: string;
  /** Optional separate output directory for headers */
  headerOutDir?: string;
  /** Optional base path to strip from header output paths */
  basePath?: string;
}

/**
 * Resolves output paths for transpiled files
 */
class PathResolver {
  private readonly config: IPathResolverConfig;

  constructor(config: IPathResolverConfig) {
    this.config = config;
  }

  /**
   * Get relative path from any input directory for a file.
   * Returns the relative path (e.g., "Display/Utils.cnx") or null if the file
   * is not under any input directory.
   *
   * This is the core utility used by getSourceRelativePath, getOutputPath,
   * and getHeaderOutputPath for directory structure preservation.
   */
  getRelativePathFromInputs(filePath: string): string | null {
    for (const input of this.config.inputs) {
      const resolvedInput = resolve(input);

      // Skip if input is a file (not a directory) - can't preserve structure
      if (existsSync(resolvedInput) && statSync(resolvedInput).isFile()) {
        continue;
      }

      const relativePath = relative(resolvedInput, filePath);

      // Check if file is under this input directory
      if (relativePath && !relativePath.startsWith("..")) {
        return relativePath;
      }
    }

    return null;
  }

  /**
   * Issue #339: Get relative path from input directory for self-include generation.
   * Returns the relative path (e.g., "Display/Utils.cnx") or just the basename
   * if the file is not in any input directory.
   */
  getSourceRelativePath(filePath: string): string {
    return this.getRelativePathFromInputs(filePath) ?? basename(filePath);
  }

  /**
   * Get output path for a transpiled file (.c or .cpp)
   *
   * @param file - The discovered file to get output path for
   * @param cppMode - If true, output .cpp; otherwise .c
   * @returns The full output path
   */
  getOutputPath(file: IDiscoveredFile, cppMode: boolean): string {
    const ext = cppMode ? ".cpp" : ".c";

    const relativePath = this.getRelativePathFromInputs(file.path);
    if (relativePath) {
      // File is under an input directory - preserve structure
      const outputRelative = relativePath.replace(/\.cnx$|\.cnext$/, ext);
      const outputPath = join(this.config.outDir, outputRelative);

      const outputDir = dirname(outputPath);
      if (!existsSync(outputDir)) {
        mkdirSync(outputDir, { recursive: true });
      }

      return outputPath;
    }

    // Fallback: output next to the source file (not in outDir)
    // This handles included files that aren't under any input directory
    const outputName = basename(file.path).replace(/\.cnx$|\.cnext$/, ext);
    return join(dirname(file.path), outputName);
  }

  /**
   * Get output path for a header file (.h)
   * Uses headerOutDir if specified, otherwise falls back to outDir
   *
   * @param file - The discovered file to get header path for
   * @returns The full header output path
   */
  getHeaderOutputPath(file: IDiscoveredFile): string {
    // Use headerOutDir if specified, otherwise fall back to outDir
    const headerDir = this.config.headerOutDir || this.config.outDir;

    const relativePath = this.getRelativePathFromInputs(file.path);
    if (relativePath) {
      // File is under an input directory - preserve structure (minus basePath)
      const strippedPath = this.stripBasePath(relativePath);
      const outputRelative = strippedPath.replace(/\.cnx$|\.cnext$/, ".h");
      const outputPath = join(headerDir, outputRelative);

      const outputDir = dirname(outputPath);
      if (!existsSync(outputDir)) {
        mkdirSync(outputDir, { recursive: true });
      }

      return outputPath;
    }

    // Issue #489: If headerOutDir is explicitly set, use it with relative path from CWD
    // This handles single-file inputs like "cnext src/AppConfig.cnx" with headerOut config
    if (this.config.headerOutDir) {
      const cwd = process.cwd();
      const relativeFromCwd = relative(cwd, file.path);
      // Only use CWD-relative path if file is under CWD (not starting with ..)
      if (relativeFromCwd && !relativeFromCwd.startsWith("..")) {
        const strippedPath = this.stripBasePath(relativeFromCwd);
        const outputRelative = strippedPath.replace(/\.cnx$|\.cnext$/, ".h");
        const outputPath = join(this.config.headerOutDir, outputRelative);

        const outputDir = dirname(outputPath);
        if (!existsSync(outputDir)) {
          mkdirSync(outputDir, { recursive: true });
        }

        return outputPath;
      }

      // File outside CWD: put in headerOutDir with just basename
      const headerName = basename(file.path).replace(/\.cnx$|\.cnext$/, ".h");
      const outputPath = join(this.config.headerOutDir, headerName);

      if (!existsSync(this.config.headerOutDir)) {
        mkdirSync(this.config.headerOutDir, { recursive: true });
      }

      return outputPath;
    }

    // Fallback: output next to the source file (no headerDir specified)
    // This handles included files that aren't under any input directory
    const headerName = basename(file.path).replace(/\.cnx$|\.cnext$/, ".h");
    return join(dirname(file.path), headerName);
  }

  /**
   * Strip basePath prefix from a relative path
   * e.g., "src/AppConfig.cnx" with basePath "src" -> "AppConfig.cnx"
   */
  private stripBasePath(relPath: string): string {
    if (!this.config.basePath || !this.config.headerOutDir) {
      return relPath;
    }
    // Normalize basePath (remove trailing slashes)
    const base = this.config.basePath.replace(/[/\\]+$/, "");
    // Check if relPath starts with basePath (+ separator or exact match)
    if (relPath === base) {
      return "";
    }
    if (relPath.startsWith(base + "/") || relPath.startsWith(base + "\\")) {
      return relPath.slice(base.length + 1);
    }
    return relPath;
  }
}

export default PathResolver;
