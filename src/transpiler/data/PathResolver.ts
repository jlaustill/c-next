/**
 * PathResolver
 * Handles path calculations for output files.
 *
 * Consolidates path resolution logic used by Transpiler and CleanCommand,
 * including directory structure preservation.
 */

import { join, basename, relative, dirname, resolve, sep } from "node:path";

import IDiscoveredFile from "./types/IDiscoveredFile";
import type TSourceExtension from "../types/TSourceExtension";
import type THeaderExtension from "../types/THeaderExtension";
import IFileSystem from "../types/IFileSystem";
import NodeFileSystem from "../NodeFileSystem";

/** Default file system instance (singleton for performance) */
const defaultFs = NodeFileSystem.instance;

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
}

/**
 * Resolves output paths for transpiled files
 */
class PathResolver {
  private readonly config: IPathResolverConfig;
  private readonly fs: IFileSystem;

  constructor(config: IPathResolverConfig, fs: IFileSystem = defaultFs) {
    this.config = config;
    this.fs = fs;
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
      if (this.fs.exists(resolvedInput) && this.fs.isFile(resolvedInput)) {
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
   * Issue #1319: takes the run's source extension rather than its mode. Naming
   * an output file is a decision, and `data/` is the earliest layer -- it is
   * told the answer rather than deriving one, which is what let the mode-to-
   * extension decision collapse to a single owner.
   *
   * @param file - The discovered file to get output path for
   * @param ext - The run's source extension (".c" or ".cpp")
   * @returns The full output path
   */
  getOutputPath(file: IDiscoveredFile, ext: TSourceExtension): string {
    const relativePath = this.getRelativePathFromInputs(file.path);
    if (relativePath) {
      // File is under an input directory - preserve structure
      const outputRelative = relativePath.replace(/\.cnx$|\.cnext$/, ext);
      const outputPath = join(this.config.outDir, outputRelative);

      const outputDir = dirname(outputPath);
      if (!this.fs.exists(outputDir)) {
        this.fs.mkdir(outputDir, { recursive: true });
      }

      return outputPath;
    }

    // Fallback: output next to the source file (not in outDir)
    // This handles included files that aren't under any input directory
    const outputName = basename(file.path).replace(/\.cnx$|\.cnext$/, ext);
    return join(dirname(file.path), outputName);
  }

  /**
   * Get output path for a header file (.h or .hpp)
   * Uses headerOutDir if specified, otherwise falls back to outDir
   *
   * Issue #1319: takes the run's header extension rather than its mode. This
   * parameter previously defaulted to `false`, so a caller that forgot it got
   * `.h` in a C++ run with nothing reporting the mismatch -- while the sibling
   * `getOutputPath` required the same fact.
   *
   * @param file - The discovered file to get header path for
   * @param ext - The run's header extension (".h" or ".hpp", Issue #933)
   * @returns The full header output path
   */
  getHeaderOutputPath(file: IDiscoveredFile, ext: THeaderExtension): string {
    const outputPath = this.headerPathFor(file.path, ext);

    const outputDir = dirname(outputPath);
    if (!this.fs.exists(outputDir)) {
      this.fs.mkdir(outputDir, { recursive: true });
    }

    return outputPath;
  }

  /**
   * Issue #1467: the path an `#include` must name to reach the header this
   * resolver will write for `cnxPath`, relative to the header output root.
   *
   * This is the single answer to "which header does this include resolve to?".
   * It is DERIVED from `headerPathFor` -- the same calculation that decides
   * where the header is written -- because those two facts were computed
   * independently before, and a derivation that merely agrees is a latent
   * divergence. Nothing downstream may re-derive it from the author's
   * spelling: a bare `<utils.cnx>` and a nested header are both legal, and
   * only this method knows they go together.
   *
   * Returns null when the header lands outside the header output root, where
   * no path relative to that root can name it and `-I <header-out>` cannot
   * work regardless. The caller keeps the author's spelling there.
   */
  getHeaderIncludePath(cnxPath: string, ext: THeaderExtension): string | null {
    const headerDir = this.config.headerOutDir || this.config.outDir;
    const includePath = relative(
      resolve(headerDir),
      resolve(this.headerPathFor(cnxPath, ext)),
    );

    if (!includePath || includePath.startsWith("..")) {
      return null;
    }

    // POSIX separators: this becomes the text inside `#include <...>`, which
    // is not a filesystem path in the generated C.
    return includePath.split(sep).join("/");
  }

  /**
   * Issue #1467: where the header for `cnxPath` goes. Pure -- it creates no
   * directories, so `getHeaderIncludePath` can ask the question without the
   * side effect that answering it used to carry.
   */
  private headerPathFor(cnxPath: string, ext: THeaderExtension): string {
    // Use headerOutDir if specified, otherwise fall back to outDir
    const headerDir = this.config.headerOutDir || this.config.outDir;

    const relativePath = this.getRelativePathFromInputs(cnxPath);
    if (relativePath) {
      // File is under an input directory - preserve structure
      return join(headerDir, relativePath.replace(/\.cnx$|\.cnext$/, ext));
    }

    // Issue #489: If headerOutDir is explicitly set, use it with relative path from CWD
    // This handles single-file inputs like "cnext src/AppConfig.cnx" with headerOut config
    if (this.config.headerOutDir) {
      const relativeFromCwd = relative(process.cwd(), cnxPath);
      // Only use CWD-relative path if file is under CWD (not starting with ..)
      if (relativeFromCwd && !relativeFromCwd.startsWith("..")) {
        return join(
          this.config.headerOutDir,
          relativeFromCwd.replace(/\.cnx$|\.cnext$/, ext),
        );
      }

      // File outside CWD: put in headerOutDir with just basename
      return join(
        this.config.headerOutDir,
        basename(cnxPath).replace(/\.cnx$|\.cnext$/, ext),
      );
    }

    // Fallback: output next to the source file (no headerDir specified)
    // This handles included files that aren't under any input directory
    return join(
      dirname(cnxPath),
      basename(cnxPath).replace(/\.cnx$|\.cnext$/, ext),
    );
  }
}

export default PathResolver;
