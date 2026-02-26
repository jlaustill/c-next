import { dirname, join, resolve } from "node:path";

import IncludeDiscovery from "./IncludeDiscovery";
import FileDiscovery from "./FileDiscovery";
import IDiscoveredFile from "./types/IDiscoveredFile";
import EFileType from "./types/EFileType";
import DependencyGraph from "./DependencyGraph";
import IFileSystem from "../types/IFileSystem";
import NodeFileSystem from "../NodeFileSystem";

/** Default file system instance (singleton for performance) */
const defaultFs = NodeFileSystem.instance;

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
 * used by the unified `transpile()` entry point for both file and source modes.
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
  private readonly cppMode: boolean;

  /**
   * @param cppMode Controls .h vs .hpp extension for .cnx include directives.
   *   Note: In the Transpiler, cppDetected may change after IncludeResolver runs
   *   (e.g., when a .hpp header is discovered during Stage 2). HeaderGeneratorUtils
   *   uses stem-based dedup to handle any resulting .h/.hpp mismatch.
   */
  constructor(
    private readonly searchPaths: string[],
    fs: IFileSystem = defaultFs,
    cppMode: boolean = false,
  ) {
    this.fs = fs;
    this.cppMode = cppMode;
  }

  /**
   * Extract includes from source content and resolve them to files
   *
   * @param content - Source file content
   * @param sourceFilePath - Optional path to source file (for error messages)
   * @returns Resolved includes categorized by type, plus warnings
   */
  resolve(content: string, sourceFilePath?: string): IResolvedIncludes {
    const result: IResolvedIncludes = {
      headers: [],
      cnextIncludes: [],
      warnings: [],
      headerIncludeDirectives: new Map<string, string>(),
    };

    const includes = IncludeDiscovery.extractIncludesWithInfo(content);

    for (const includeInfo of includes) {
      this._processInclude(includeInfo, sourceFilePath, result);
    }

    return result;
  }

  /**
   * Process a single include directive
   */
  private _processInclude(
    includeInfo: { path: string; isLocal: boolean },
    sourceFilePath: string | undefined,
    result: IResolvedIncludes,
  ): void {
    const resolved = IncludeDiscovery.resolveInclude(
      includeInfo.path,
      this.searchPaths,
      this.fs,
    );

    if (!resolved) {
      this._handleUnresolvedInclude(
        includeInfo,
        sourceFilePath,
        result.warnings,
      );
      return;
    }

    this._handleResolvedInclude(resolved, includeInfo, result);
  }

  /**
   * Handle a resolved include path
   */
  private _handleResolvedInclude(
    resolved: string,
    includeInfo: { path: string; isLocal: boolean },
    result: IResolvedIncludes,
  ): void {
    const absolutePath = resolve(resolved);

    // Deduplicate by absolute path
    if (this.resolvedPaths.has(absolutePath)) {
      return;
    }
    this.resolvedPaths.add(absolutePath);

    const file = FileDiscovery.discoverFile(resolved, this.fs);
    if (!file) return;

    this._categorizeFile(file, absolutePath, includeInfo, result);
  }

  /**
   * Categorize a discovered file into headers or cnext includes
   */
  private _categorizeFile(
    file: IDiscoveredFile,
    absolutePath: string,
    includeInfo: { path: string; isLocal: boolean },
    result: IResolvedIncludes,
  ): void {
    if (file.type === EFileType.CHeader || file.type === EFileType.CppHeader) {
      result.headers.push(file);
      // Issue #497: Track the original include directive for this header
      const directive = includeInfo.isLocal
        ? `#include "${includeInfo.path}"`
        : `#include <${includeInfo.path}>`;
      result.headerIncludeDirectives.set(absolutePath, directive);
      return;
    }

    if (file.type === EFileType.CNext) {
      result.cnextIncludes.push(file);
      // Issue #854: Track header directive for cnext includes so their types
      // can be mapped by ExternalTypeHeaderBuilder, preventing duplicate
      // forward declarations (MISRA Rule 5.6)
      const ext = this.cppMode ? ".hpp" : ".h";
      const headerPath = includeInfo.path.replace(/\.cnx$|\.cnext$/, ext);
      const directive = includeInfo.isLocal
        ? `#include "${headerPath}"`
        : `#include <${headerPath}>`;
      result.headerIncludeDirectives.set(absolutePath, directive);
    }
  }

  /**
   * Handle an unresolved include (warn for local includes only)
   */
  private _handleUnresolvedInclude(
    includeInfo: { path: string; isLocal: boolean },
    sourceFilePath: string | undefined,
    warnings: string[],
  ): void {
    // System includes (<...>) that aren't found are silently ignored
    if (!includeInfo.isLocal) return;

    const fromFile = sourceFilePath ? ` (from ${sourceFilePath})` : "";
    warnings.push(
      `Warning: #include "${includeInfo.path}" not found${fromFile}. ` +
        `Struct field types from this header will not be detected.`,
    );
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
   * Check if a resolved include is a header file to process.
   */
  private static isProcessableHeader(file: IDiscoveredFile | null): boolean {
    return (
      file !== null &&
      (file.type === EFileType.CHeader || file.type === EFileType.CppHeader)
    );
  }

  /**
   * Read header content, returning null if not readable or if generated by C-Next.
   */
  private static readHeaderContent(
    file: IDiscoveredFile,
    fs: IFileSystem,
    warnings: string[],
    onDebug?: (message: string) => void,
  ): string | null {
    let content: string;
    try {
      content = fs.readFile(file.path);
    } catch {
      warnings.push(`Warning: Could not read header ${file.path}`);
      return null;
    }

    if (content.includes("Generated by C-Next Transpiler")) {
      onDebug?.(`Skipping C-Next generated header: ${file.path}`);
      return null;
    }

    return content;
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

      if (visited.has(absolutePath)) return;
      visited.add(absolutePath);

      const content = IncludeResolver.readHeaderContent(
        file,
        fs,
        warnings,
        options?.onDebug,
      );
      if (!content) return;

      depGraph.addFile(absolutePath);
      fileByPath.set(absolutePath, file);

      const includes = IncludeDiscovery.extractIncludesWithInfo(content);
      const searchPaths = [dirname(absolutePath), ...includeDirs];

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

        if (!resolved) {
          if (includeInfo.isLocal) {
            warnings.push(
              `Warning: #include "${includeInfo.path}" not found (from ${file.path}). ` +
                `Struct field types from this header will not be detected.`,
            );
          }
          continue;
        }

        const includedFile = FileDiscovery.discoverFile(resolved, fs);
        if (!IncludeResolver.isProcessableHeader(includedFile)) continue;

        const includedPath = resolve(includedFile!.path);
        depGraph.addDependency(absolutePath, includedPath);

        options?.onDebug?.(
          `    → Recursively processing ${includedFile!.path}`,
        );
        processHeader(includedFile!);
      }
    };

    for (const header of rootHeaders) {
      processHeader(header);
    }

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
   * Consolidates the search path building logic used by the unified
   * transpile() entry point.
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
