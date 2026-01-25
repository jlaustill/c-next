import { existsSync, statSync } from "fs";
import { join, resolve } from "path";

import IncludeDiscovery from "./IncludeDiscovery";
import FileDiscovery from "../project/FileDiscovery";
import IDiscoveredFile from "../project/types/IDiscoveredFile";
import EFileType from "../project/types/EFileType";

/**
 * Result of resolving includes from source content
 */
interface IResolvedIncludes {
  /** C/C++ headers to parse for symbol collection */
  headers: IDiscoveredFile[];

  /** C-Next files to parse for symbol collection */
  cnextIncludes: IDiscoveredFile[];

  /** Warnings for unresolved local includes */
  warnings: string[];
}

/**
 * Unified include resolution for the C-Next Pipeline
 *
 * This class encapsulates the complete include resolution workflow,
 * used by both `run()` (CLI) and `transpileSource()` (API) paths.
 *
 * Key responsibilities:
 * - Extract #include directives from source content
 * - Resolve include paths using search directories
 * - Categorize resolved files into headers vs C-Next includes
 * - Track warnings for unresolved local includes
 * - Deduplicate resolved files by path
 *
 * @example
 * const resolver = new IncludeResolver(['/path/to/includes']);
 * const result = resolver.resolve('#include "header.h"');
 * // result.headers contains resolved header files
 */
class IncludeResolver {
  /** Resolved includes interface for external use */
  static readonly ResolvedIncludesType: IResolvedIncludes = undefined as never;

  private resolvedPaths: Set<string> = new Set();

  constructor(private searchPaths: string[]) {}

  /**
   * Extract includes from source content and resolve them to files
   *
   * @param content - Source file content
   * @param sourceFilePath - Optional path to source file (for error messages)
   * @returns Resolved includes categorized by type, plus warnings
   */
  resolve(content: string, sourceFilePath?: string): IResolvedIncludes {
    const headers: IDiscoveredFile[] = [];
    const cnextIncludes: IDiscoveredFile[] = [];
    const warnings: string[] = [];

    const includes = IncludeDiscovery.extractIncludesWithInfo(content);

    for (const includeInfo of includes) {
      const resolved = IncludeDiscovery.resolveInclude(
        includeInfo.path,
        this.searchPaths,
      );

      if (resolved) {
        // Deduplicate by absolute path
        const absolutePath = resolve(resolved);
        if (this.resolvedPaths.has(absolutePath)) {
          continue;
        }
        this.resolvedPaths.add(absolutePath);

        const file = FileDiscovery.discoverFile(resolved);
        if (file) {
          if (
            file.type === EFileType.CHeader ||
            file.type === EFileType.CppHeader
          ) {
            headers.push(file);
          } else if (file.type === EFileType.CNext) {
            cnextIncludes.push(file);
          }
        }
      } else if (includeInfo.isLocal) {
        // Warn about unresolved local includes (not system includes)
        const fromFile = sourceFilePath ? ` (from ${sourceFilePath})` : "";
        warnings.push(
          `Warning: #include "${includeInfo.path}" not found${fromFile}. ` +
            `Struct field types from this header will not be detected.`,
        );
      }
      // System includes (<...>) that aren't found are silently ignored
    }

    return { headers, cnextIncludes, warnings };
  }

  /**
   * Reset the resolved paths set (for reuse across multiple files)
   */
  reset(): void {
    this.resolvedPaths.clear();
  }

  /**
   * Get the set of resolved paths (for deduplication across resolver instances)
   */
  getResolvedPaths(): ReadonlySet<string> {
    return this.resolvedPaths;
  }

  /**
   * Add already-resolved paths to prevent re-resolution
   */
  addResolvedPaths(paths: Iterable<string>): void {
    for (const path of paths) {
      this.resolvedPaths.add(path);
    }
  }

  /**
   * Build search paths from a source file location
   *
   * Consolidates the search path building logic used by both `run()` and
   * `transpileSource()` code paths.
   *
   * Search order (highest to lowest priority):
   * 1. Source file's directory (for relative includes)
   * 2. Additional include directories (e.g., from --include flag)
   * 3. Config include directories
   * 4. Project-level common directories (include/, src/, lib/)
   *
   * @param sourceDir - Directory containing the source file
   * @param includeDirs - Include directories from config
   * @param additionalIncludeDirs - Extra include directories (e.g., from API options)
   * @param projectRoot - Optional project root for common directory discovery
   * @returns Array of search paths in priority order
   */
  static buildSearchPaths(
    sourceDir: string,
    includeDirs: string[],
    additionalIncludeDirs: string[] = [],
    projectRoot?: string,
  ): string[] {
    const paths: string[] = [];

    // 1. Source file's directory (highest priority)
    paths.push(sourceDir);

    // 2. Additional include directories
    paths.push(...additionalIncludeDirs);

    // 3. Config include directories
    paths.push(...includeDirs);

    // 4. Project-level common directories
    const root = projectRoot ?? IncludeDiscovery.findProjectRoot(sourceDir);
    if (root) {
      const commonDirs = ["include", "src", "lib"];
      for (const dir of commonDirs) {
        const includePath = join(root, dir);
        if (existsSync(includePath) && statSync(includePath).isDirectory()) {
          paths.push(includePath);
        }
      }
    }

    // Remove duplicates while preserving order
    return Array.from(new Set(paths));
  }
}

export default IncludeResolver;
