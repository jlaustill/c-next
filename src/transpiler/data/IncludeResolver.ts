import { dirname, join, resolve } from "node:path";

import IncludeDiscovery from "./IncludeDiscovery";
import FileDiscovery from "./FileDiscovery";
import IDiscoveredFile from "./types/IDiscoveredFile";
import EFileType from "./types/EFileType";
import DependencyGraph from "./DependencyGraph";
import IFileSystem from "../types/IFileSystem";
import NodeFileSystem from "../NodeFileSystem";

/** Default file system instance (singleton for performance) */
const defaultFs = new NodeFileSystem();

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

  /**
   * Issue #497: Map from resolved header path to original include directive.
   * Used to include C headers (instead of forward declarations) when their
   * types are used in public interfaces.
   * Example: "/abs/path/data-types.h" => '#include "data-types.h"'
   */
  headerIncludeDirectives: Map<string, string>;
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
  /**
   * Type helper for accessing IResolvedIncludes externally.
   * Use: `type IResolvedIncludes = ReturnType<InstanceType<typeof IncludeResolver>["resolve"]>`
   */
  static readonly _resolvedIncludesType: IResolvedIncludes = undefined as never;

  private readonly resolvedPaths: Set<string> = new Set();
  private readonly fs: IFileSystem;

  constructor(
    private readonly searchPaths: string[],
    fs: IFileSystem = defaultFs,
  ) {
    this.fs = fs;
  }

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
    const headerIncludeDirectives = new Map<string, string>();

    const includes = IncludeDiscovery.extractIncludesWithInfo(content);

    for (const includeInfo of includes) {
      const resolved = IncludeDiscovery.resolveInclude(
        includeInfo.path,
        this.searchPaths,
        this.fs,
      );

      if (resolved) {
        // Deduplicate by absolute path
        const absolutePath = resolve(resolved);
        if (this.resolvedPaths.has(absolutePath)) {
          continue;
        }
        this.resolvedPaths.add(absolutePath);

        const file = FileDiscovery.discoverFile(resolved, this.fs);
        if (file) {
          if (
            file.type === EFileType.CHeader ||
            file.type === EFileType.CppHeader
          ) {
            headers.push(file);
            // Issue #497: Track the original include directive for this header
            const directive = includeInfo.isLocal
              ? `#include "${includeInfo.path}"`
              : `#include <${includeInfo.path}>`;
            headerIncludeDirectives.set(absolutePath, directive);
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

    return { headers, cnextIncludes, warnings, headerIncludeDirectives };
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
   * Issue #592: Recursively resolve all headers from a set of root headers.
   *
   * This method handles the recursive include graph traversal that was
   * previously in Transpiler.doCollectHeaderSymbols(). It:
   * - Discovers all nested #include directives
   * - Tracks visited paths to avoid cycles
   * - Returns headers in dependency order (dependencies first)
   * - Skips headers generated by C-Next Transpiler
   *
   * @param rootHeaders - Initial set of headers to resolve from
   * @param includeDirs - Include directories for resolving nested includes
   * @param options - Optional configuration
   * @returns All headers (root + nested) in dependency order
   */
  static resolveHeadersTransitively(
    rootHeaders: IDiscoveredFile[],
    includeDirs: string[],
    options?: {
      /** Callback for debug logging */
      onDebug?: (message: string) => void;
      /** Set of already-processed paths to skip */
      processedPaths?: Set<string>;
      /** File system abstraction (defaults to NodeFileSystem) */
      fs?: IFileSystem;
    },
  ): { headers: IDiscoveredFile[]; warnings: string[] } {
    const fs = options?.fs ?? defaultFs;
    const visited = new Set<string>(options?.processedPaths);
    const warnings: string[] = [];
    const depGraph = new DependencyGraph();
    const fileByPath = new Map<string, IDiscoveredFile>();

    const processHeader = (file: IDiscoveredFile): void => {
      const absolutePath = resolve(file.path);

      // Skip if already visited (cycle detection)
      if (visited.has(absolutePath)) {
        return;
      }
      visited.add(absolutePath);

      // Read content to check for generated headers and extract includes
      let content: string;
      try {
        content = fs.readFile(file.path);
      } catch {
        warnings.push(`Warning: Could not read header ${file.path}`);
        return;
      }

      // Skip headers generated by C-Next Transpiler
      if (content.includes("Generated by C-Next Transpiler")) {
        options?.onDebug?.(`Skipping C-Next generated header: ${file.path}`);
        return;
      }

      // Add to graph and file map
      depGraph.addFile(absolutePath);
      fileByPath.set(absolutePath, file);

      // Extract and resolve nested includes
      const includes = IncludeDiscovery.extractIncludesWithInfo(content);
      const headerDir = dirname(absolutePath);
      const searchPaths = [headerDir, ...includeDirs];

      options?.onDebug?.(`Processing includes in ${file.path}:`);
      options?.onDebug?.(`  Search paths: ${searchPaths.join(", ")}`);

      for (const includeInfo of includes) {
        const resolved = IncludeDiscovery.resolveInclude(
          includeInfo.path,
          searchPaths,
          fs,
        );

        options?.onDebug?.(
          `  #include "${includeInfo.path}" → ${resolved ?? "NOT FOUND"}`,
        );

        if (resolved) {
          const includedFile = FileDiscovery.discoverFile(resolved, fs);
          if (
            includedFile &&
            (includedFile.type === EFileType.CHeader ||
              includedFile.type === EFileType.CppHeader)
          ) {
            const includedPath = resolve(includedFile.path);

            // Track dependency: current file depends on included file
            depGraph.addDependency(absolutePath, includedPath);

            // Recursively process the included header
            options?.onDebug?.(
              `    → Recursively processing ${includedFile.path}`,
            );
            processHeader(includedFile);
          }
        } else if (includeInfo.isLocal) {
          // Warn about unresolved local includes
          warnings.push(
            `Warning: #include "${includeInfo.path}" not found (from ${file.path}). ` +
              `Struct field types from this header will not be detected.`,
          );
        }
      }
    };

    // Process all root headers
    for (const header of rootHeaders) {
      processHeader(header);
    }

    // Get headers in dependency order (dependencies first)
    const sortedPaths = depGraph.getSortedFiles();
    warnings.push(...depGraph.getWarnings());

    const sortedHeaders: IDiscoveredFile[] = [];
    for (const path of sortedPaths) {
      const file = fileByPath.get(path);
      if (file) {
        sortedHeaders.push(file);
      }
    }

    return { headers: sortedHeaders, warnings };
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
   * @param fs - File system abstraction (defaults to NodeFileSystem)
   * @returns Array of search paths in priority order
   */
  static buildSearchPaths(
    sourceDir: string,
    includeDirs: string[],
    additionalIncludeDirs: string[] = [],
    projectRoot?: string,
    fs: IFileSystem = defaultFs,
  ): string[] {
    const paths: string[] = [];

    // Search path priority: 1) source dir, 2) additional dirs, 3) config dirs
    paths.push(sourceDir, ...additionalIncludeDirs, ...includeDirs);

    // 4. Project-level common directories
    const root = projectRoot ?? IncludeDiscovery.findProjectRoot(sourceDir, fs);
    if (root) {
      const commonDirs = ["include", "src", "lib"];
      for (const dir of commonDirs) {
        const includePath = join(root, dir);
        if (fs.exists(includePath) && fs.isDirectory(includePath)) {
          paths.push(includePath);
        }
      }
    }

    // Remove duplicates while preserving order
    return Array.from(new Set(paths));
  }
}

export default IncludeResolver;
