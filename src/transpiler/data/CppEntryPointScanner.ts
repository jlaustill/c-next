import { dirname, join, resolve } from "node:path";
import IncludeDiscovery from "./IncludeDiscovery";
import CNextMarkerDetector from "./CNextMarkerDetector";
import IFileSystem from "../types/IFileSystem";
import NodeFileSystem from "../NodeFileSystem";

/**
 * Result of scanning a C/C++ entry point for C-Next sources.
 */
interface IScanResult {
  /** Absolute paths to discovered .cnx source files */
  cnextSources: string[];
  /** Errors encountered (e.g., missing .cnx files referenced by markers) */
  errors: string[];
  /** Warnings encountered (e.g., includes that couldn't be resolved) */
  warnings: string[];
  /** True if no C-Next markers were found (not an error, just informational) */
  noCNextFound: boolean;
}

/**
 * Scans C/C++ entry point files to discover C-Next source dependencies.
 *
 * Walks the include tree starting from a C/C++ file, looks for C-Next
 * generation markers in headers, and extracts the source .cnx paths.
 * Follows includes transitively through discovered .cnx files.
 *
 * Used by the C/C++ entry point feature (ADR-XXX) to enable compilation
 * where the entry point is a C/C++ file that #includes C-Next generated headers.
 */
class CppEntryPointScanner {
  private readonly fs: IFileSystem;
  private readonly searchPaths: string[];
  private readonly visited = new Set<string>();
  private readonly cnextSources = new Set<string>();
  private readonly errors: string[] = [];
  private readonly warnings: string[] = [];

  constructor(
    searchPaths: string[],
    fs: IFileSystem = NodeFileSystem.instance,
  ) {
    this.searchPaths = searchPaths;
    this.fs = fs;
  }

  /**
   * Scan an entry point file for C-Next source dependencies.
   *
   * @param entryPath - Path to the C/C++ entry point file
   * @returns Scan result with discovered sources, errors, and warnings
   */
  scan(entryPath: string): IScanResult {
    const absolutePath = resolve(entryPath);
    this._scanFile(absolutePath);

    return {
      cnextSources: Array.from(this.cnextSources),
      errors: this.errors,
      warnings: this.warnings,
      noCNextFound: this.cnextSources.size === 0 && this.errors.length === 0,
    };
  }

  /**
   * Scan a file for includes and process them.
   */
  private _scanFile(filePath: string): void {
    if (this.visited.has(filePath)) return;
    this.visited.add(filePath);

    let content: string;
    try {
      content = this.fs.readFile(filePath);
    } catch {
      this.warnings.push(`Warning: Could not read ${filePath}`);
      return;
    }

    const includes = IncludeDiscovery.extractIncludesWithInfo(content);
    const fileDir = dirname(filePath);
    const localSearchPaths = [fileDir, ...this.searchPaths];

    for (const includeInfo of includes) {
      this._processInclude(includeInfo, localSearchPaths, filePath);
    }
  }

  /**
   * Process a single include directive.
   */
  private _processInclude(
    includeInfo: { path: string; isLocal: boolean },
    searchPaths: string[],
    fromFile: string,
  ): void {
    const resolved = IncludeDiscovery.resolveInclude(
      includeInfo.path,
      searchPaths,
      this.fs,
    );

    if (!resolved) {
      // Only warn for local includes that couldn't be resolved
      // System includes (like <stdio.h>) are expected to not be found
      if (includeInfo.isLocal) {
        this.warnings.push(
          `Warning: #include "${includeInfo.path}" not found (from ${fromFile})`,
        );
      }
      return;
    }

    const absolutePath = resolve(resolved);
    if (this.visited.has(absolutePath)) return;

    let headerContent: string;
    try {
      headerContent = this.fs.readFile(absolutePath);
    } catch {
      return;
    }

    // Check if this is a C-Next generated header
    const sourcePath = CNextMarkerDetector.extractSourcePath(headerContent);
    if (sourcePath) {
      // New-style marker with source path
      this._handleCNextMarker(sourcePath, absolutePath);
    } else if (CNextMarkerDetector.isCNextGenerated(headerContent)) {
      // Old-style marker without source path - treat as leaf node
      // (we know it's C-Next generated but can't determine the source)
      this.visited.add(absolutePath);
    } else {
      // Not a C-Next generated header - scan it for nested includes
      this._scanFile(absolutePath);
    }
  }

  /**
   * Handle a C-Next generation marker found in a header.
   *
   * Resolves the source path by first checking relative to the header location,
   * then searching the include paths. This supports both default behavior (header
   * next to source) and --header-out (header in separate directory).
   */
  private _handleCNextMarker(sourcePath: string, headerPath: string): void {
    const headerDir = dirname(headerPath);
    let absoluteSourcePath = resolve(join(headerDir, sourcePath));

    // If not found next to header, search include paths (supports --header-out)
    if (!this.fs.exists(absoluteSourcePath)) {
      for (const searchPath of this.searchPaths) {
        const candidate = resolve(join(searchPath, sourcePath));
        if (this.fs.exists(candidate)) {
          absoluteSourcePath = candidate;
          break;
        }
      }
    }

    if (!this.fs.exists(absoluteSourcePath)) {
      this.errors.push(
        `C-Next source not found: ${sourcePath} (referenced by ${headerPath})`,
      );
      return;
    }

    this.cnextSources.add(absoluteSourcePath);
    // Scan the .cnx file for its own includes (transitive discovery)
    this._scanFile(absoluteSourcePath);
  }
}

export default CppEntryPointScanner;
