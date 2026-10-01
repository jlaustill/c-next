import { dirname, join, resolve } from "node:path";

import CNextMarkerDetector from "./CNextMarkerDetector";
import IncludeDiscovery from "./IncludeDiscovery";
import IncludeRewriter from "./IncludeRewriter";
import FileDiscovery from "./FileDiscovery";
import type THeaderExtension from "../types/THeaderExtension";
import IDiscoveredFile from "./types/IDiscoveredFile";
import type IHeaderRoot from "./types/IHeaderRoot";
import EFileType from "./types/EFileType";
import DependencyGraph from "./DependencyGraph";
import IFileSystem from "../types/IFileSystem";

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
   * Whether any include brings in names this transpiler cannot see -- a C/C++
   * header, or an include that resolved to nothing and does not name C-Next
   * source (an unresolved `<system.h>` is silently ignored, and its names still
   * exist at compile time; an unresolved `.cnx` supplies no C or C++ names).
   *
   * #1399 review: consumed by the E0426/E0427 precondition. Recorded HERE
   * because this class already decides what each directive IS; the analyzer's
   * own attempt re-derived it from `#include` token text, became a third
   * spelling of "is this a C-Next include?", and was the one that missed
   * `.cnext`. `headers` alone cannot answer it -- `<stdio.h>` resolves to
   * nothing on most systems and so appears in no list at all, which is exactly
   * how `FILE` slipped through.
   */
  hasForeignInclude: boolean;

  /**
   * Issue #497: Map from resolved header path to original include directive.
   * Used to include C headers (instead of forward declarations) when their
   * types are used in public interfaces.
   * Example: "/abs/path/data-types.h" => '#include "data-types.h"'
   */
  headerIncludeDirectives: Map<string, string>;

  /**
   * Issue #1467: for each `.cnx` include, the author's spelling mapped to the
   * path the generated header is actually reachable at, relative to the header
   * output root -- e.g. `"utils.cnx"` => `"Display/utils.h"`.
   *
   * Recorded here because this class is where an include's spelling and its
   * RESOLVED file are both in hand; every consumer downstream has one or the
   * other. The value comes from the owner injected as `headerIncludePathFor`,
   * never from the spelling: those were derived independently in three places,
   * and agreed only because all three copied what the author typed.
   */
  cnextIncludeRewrites: Map<string, string>;

  /**
   * #1725: for each quoted include that resolved beside the file that wrote
   * it -- so its spelling is relative to that file -- the absolute file the
   * spelling names: the header, or the generated header beside a `.cnx` whose
   * header the output root does not reach. Keyed like
   * `headerIncludeDirectives`.
   *
   * Another file that needs the same header spells it relative to ITSELF from
   * this. Copying the spelling gave `src/main.h` lib/a.cnx's `"dev.h"`, which
   * names `src/dev.h` from there. A spelling that resolved along the search
   * path is not recorded: it is valid wherever that path is, and re-spelling it
   * relative to a file would climb into an SDK or a library directory.
   */
  writerRelativeIncludes: Map<string, string>;
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
 * const resolver = new IncludeResolver(['/path/to/includes'], '.h');
 * const result = resolver.resolve('#include "header.h"');
 * // result.headers contains resolved header files
 */
class IncludeResolver {
  private readonly resolvedPaths: Set<string> = new Set();
  private readonly fs: IFileSystem;
  private readonly headerExtension: THeaderExtension;

  /**
   * Issue #1467: asked where the generated header for a `.cnx` is reachable,
   * relative to the header output root. Null when the caller does not know
   * (no PathResolver yet) or the header lands outside that root; the author's
   * spelling is kept in that case, which is what every caller did before.
   */
  private readonly headerIncludePathFor:
    | ((cnxPath: string) => string | null)
    | null;

  /**
   * #1725: the directory a quoted include from the file being resolved
   * resolves beside (ADR-010), or null when the caller does not say -- then no
   * spelling is known to be relative to its writer, and none is recorded.
   */
  private readonly quotedIncludeDirectory: string | null;

  /**
   * @param headerIncludePathFor Issue #1467: where the generated header for a
   *   `.cnx` is reachable, relative to the header output root. See the field
   *   above for why it may be null.
   * @param quotedIncludeDirectory #1725: see the field above.
   * @param headerExtension The extension generated headers get in this run
   *   (".h" or ".hpp").
   *
   *   Issue #1319: this parameter was a mode with a `false` default, and the
   *   default was load-bearing in the wrong direction -- `IncludeTreeWalker`
   *   never passed it, so that instance answered ".h" for every C++ run. It
   *   went unnoticed because the walker returned only `cnextIncludes` and
   *   dropped the one field the extension feeds. #1319 let that caller pass
   *   `null`; #1435 deleted the walker, the one caller that read no directive,
   *   so the parameter is required and never null. With no default, no caller
   *   can inherit a wrong extension.
   *
   *   This used to be readable before the fact settled: cppDetected was raised
   *   by discovering a header, which could happen after IncludeResolver ran, so
   *   the extension here could be stale and HeaderGeneratorUtils absorbed the
   *   resulting .h/.hpp mismatch with stem-based dedup. #1319 made the mode
   *   declared, so it is known before any file is opened and there is no longer
   *   an early read to get wrong.
   */
  constructor(
    private readonly searchPaths: string[],
    headerExtension: THeaderExtension,
    fs: IFileSystem,
    headerIncludePathFor: ((cnxPath: string) => string | null) | null = null,
    quotedIncludeDirectory: string | null = null,
  ) {
    this.fs = fs;
    this.headerExtension = headerExtension;
    this.headerIncludePathFor = headerIncludePathFor;
    this.quotedIncludeDirectory = quotedIncludeDirectory;
  }

  /**
   * Extract includes from source content and resolve them to files
   *
   * @param content - A `.cnx` file's content. Its directives are read as the
   *   grammar reads them (#1745), so C header text does not belong here.
   * @param sourceFilePath - Optional path to source file (for error messages)
   * @returns Resolved includes categorized by type, plus warnings
   */
  resolve(content: string, sourceFilePath?: string): IResolvedIncludes {
    const result: IResolvedIncludes = {
      headers: [],
      cnextIncludes: [],
      warnings: [],
      headerIncludeDirectives: new Map<string, string>(),
      cnextIncludeRewrites: new Map<string, string>(),
      writerRelativeIncludes: new Map<string, string>(),
      hasForeignInclude: false,
    };

    const includes = IncludeDiscovery.extractCNextIncludes(content);

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
    const resolved = this._resolveSpelling(includeInfo);

    if (!resolved) {
      this._handleUnresolvedInclude(includeInfo, sourceFilePath, result);
      return;
    }

    this._handleResolvedInclude(resolved, includeInfo, result);
  }

  /**
   * Where an include resolves: a quoted `.cnx` include beside the including
   * file and only there (ADR-010, #1672), anything else along the search
   * path, as a compiler searches its -I list.
   */
  private _resolveSpelling(includeInfo: {
    path: string;
    isLocal: boolean;
  }): string | null {
    if (
      includeInfo.isLocal &&
      this.quotedIncludeDirectory !== null &&
      FileDiscovery.classifyFile(includeInfo.path).type === EFileType.CNext
    ) {
      return IncludeDiscovery.resolveQuoted(
        includeInfo.path,
        this.quotedIncludeDirectory,
        (path) => this.fs.exists(path) && this.fs.isFile(path),
      );
    }
    return IncludeDiscovery.resolveInclude(
      includeInfo.path,
      this.searchPaths,
      this.fs,
    );
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
      result.hasForeignInclude = true;
      // Issue #497: Track the original include directive for this header
      const directive = includeInfo.isLocal
        ? `#include "${includeInfo.path}"`
        : `#include <${includeInfo.path}>`;
      result.headerIncludeDirectives.set(absolutePath, directive);
      if (this._resolvedBesideWriter(includeInfo, absolutePath)) {
        result.writerRelativeIncludes.set(absolutePath, absolutePath);
      }
      return;
    }

    if (file.type === EFileType.CNext) {
      result.cnextIncludes.push(file);
      // Issue #854: Track header directive for cnext includes so their types
      // can be mapped by ExternalTypeHeaderBuilder, preventing duplicate
      // forward declarations (MISRA Rule 5.6)
      // Issue #1467: ask the owner where the header is reachable. The
      // extension swap below is the fallback for a caller with no resolver
      // and for a header outside the output root -- not a second answer.
      const reachable = this.headerIncludePathFor?.(absolutePath) ?? null;
      const headerPath =
        reachable ??
        IncludeRewriter.besideSource(includeInfo.path, this.headerExtension);
      const directive = includeInfo.isLocal
        ? `#include "${headerPath}"`
        : `#include <${headerPath}>`;
      result.headerIncludeDirectives.set(absolutePath, directive);
      result.cnextIncludeRewrites.set(includeInfo.path, headerPath);
      // #1725: an output-root path is valid from every file. The author's
      // spelling is not: its header is generated beside the `.cnx`, so that
      // file is what another includer must spell relative to itself.
      if (
        reachable === null &&
        this._resolvedBesideWriter(includeInfo, absolutePath)
      ) {
        result.writerRelativeIncludes.set(
          absolutePath,
          IncludeRewriter.besideSource(absolutePath, this.headerExtension),
        );
      }
    }
  }

  /**
   * #1725: is this a quoted include whose spelling is relative to the file
   * that wrote it -- found beside that file, not along the search path?
   */
  private _resolvedBesideWriter(
    includeInfo: { path: string; isLocal: boolean },
    absolutePath: string,
  ): boolean {
    return (
      includeInfo.isLocal &&
      this.quotedIncludeDirectory !== null &&
      resolve(this.quotedIncludeDirectory, includeInfo.path) === absolutePath
    );
  }

  /**
   * Handle an unresolved include (warn for local includes only)
   */
  private _handleUnresolvedInclude(
    includeInfo: { path: string; isLocal: boolean },
    sourceFilePath: string | undefined,
    result: IResolvedIncludes,
  ): void {
    // An include that resolved to nothing still supplies names at compile
    // time -- unless it names C-Next source, which is not a C or C++ header
    // (ADR-030) whether it is found or not. #1435 made reaching a header
    // transitive, so counting a missing `.cnx` switched E0426 off for every
    // file that reached this one.
    if (FileDiscovery.classifyFile(includeInfo.path).type !== EFileType.CNext) {
      result.hasForeignInclude = true;
    }

    const warnings = result.warnings;

    // System includes (<...>) that aren't found are silently ignored
    if (!includeInfo.isLocal) return;

    const fromFile = sourceFilePath ? ` (from ${sourceFilePath})` : "";
    warnings.push(
      `#include "${includeInfo.path}" not found${fromFile}. ` +
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
      warnings.push(`Could not read header ${file.path}`);
      return null;
    }

    // #1435: the marker is the only thing that identifies a generated header
    // now, so it is asked of the one detector rather than spelled again here.
    if (CNextMarkerDetector.isCNextGenerated(content)) {
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
   * #1723: each root is searched along its own path, and every header it
   * reaches inherits that path -- the one discovery built for the `.cnx` file
   * that included the root, discovered tiers and all. A single list of
   * `--include` directories for every header lost a libdeps header's include
   * of a sibling library, which a compiler with PlatformIO's -I path finds.
   *
   * @param roots - The headers to resolve from, each with its search path
   * @param options - Optional configuration
   * @returns All headers (root + nested) in dependency order, and the search
   *   path each was resolved along -- the -I list its preprocessing must use
   */
  static resolveHeadersTransitively(
    roots: ReadonlyArray<IHeaderRoot>,
    options: {
      /** Callback for debug logging */
      onDebug?: (message: string) => void;
      /** Set of already-processed paths to skip */
      processedPaths?: Set<string>;
      /** File system abstraction: the port the host injected */
      fs: IFileSystem;
    },
  ): {
    headers: IDiscoveredFile[];
    searchPaths: ReadonlyMap<string, readonly string[]>;
    warnings: string[];
  } {
    const fs = options.fs;
    const visited = new Set<string>(options.processedPaths);
    const warnings: string[] = [];
    const depGraph = new DependencyGraph();
    const fileByPath = new Map<string, IDiscoveredFile>();
    const searchPathsByHeader = new Map<string, readonly string[]>();

    const processHeader = (
      file: IDiscoveredFile,
      rootSearchPaths: readonly string[],
    ): void => {
      const absolutePath = resolve(file.path);

      if (visited.has(absolutePath)) return;
      visited.add(absolutePath);

      const content = IncludeResolver.readHeaderContent(
        file,
        fs,
        warnings,
        options.onDebug,
      );
      if (!content) return;

      depGraph.addFile(absolutePath);
      fileByPath.set(absolutePath, file);
      searchPathsByHeader.set(file.path, rootSearchPaths);

      const includes = IncludeDiscovery.directivesOf(file.path, content);
      const searchPaths = [dirname(absolutePath), ...rootSearchPaths];

      options.onDebug?.(`Processing includes in ${file.path}:`);
      options.onDebug?.(`  Search paths: ${searchPaths.join(", ")}`);

      for (const includeInfo of includes) {
        const resolved = IncludeDiscovery.resolveInclude(
          includeInfo.path,
          searchPaths,
          fs,
        );

        options.onDebug?.(
          `  #include "${includeInfo.path}" → ${resolved ?? "NOT FOUND"}`,
        );

        if (!resolved) {
          if (includeInfo.isLocal) {
            warnings.push(
              `#include "${includeInfo.path}" not found (from ${file.path}). ` +
                `Struct field types from this header will not be detected.`,
            );
          }
          continue;
        }

        const includedFile = FileDiscovery.discoverFile(resolved, fs);
        if (!IncludeResolver.isProcessableHeader(includedFile)) continue;

        const includedPath = resolve(includedFile!.path);
        depGraph.addDependency(absolutePath, includedPath);

        options.onDebug?.(`    → Recursively processing ${includedFile!.path}`);
        processHeader(includedFile!, rootSearchPaths);
      }
    };

    for (const root of roots) {
      processHeader(root.file, root.searchPaths);
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

    return {
      headers: sortedHeaders,
      searchPaths: searchPathsByHeader,
      warnings,
    };
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
   * @param projectRoot - Project root for common directory discovery, or undefined
   * @param fs - File system abstraction
   * @returns Array of search paths in priority order
   */
  static buildSearchPaths(
    sourceDir: string,
    includeDirs: string[],
    additionalIncludeDirs: string[],
    projectRoot: string | undefined,
    fs: IFileSystem,
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
