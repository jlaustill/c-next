/**
 * File Discovery
 * Scans directories for source files using fast-glob
 */

import fg from "fast-glob";
import { existsSync, statSync } from "node:fs";
import { extname, resolve } from "node:path";
import EFileType from "./types/EFileType";
import IDiscoveredFile from "./types/IDiscoveredFile";
import IDiscoveryOptions from "./types/IDiscoveryOptions";

/**
 * Default extensions for each file type
 */
const EXTENSION_MAP: Record<string, EFileType> = {
  ".cnx": EFileType.CNext,
  ".cnext": EFileType.CNext,
  ".h": EFileType.CHeader,
  ".hpp": EFileType.CppHeader,
  ".hxx": EFileType.CppHeader,
  ".hh": EFileType.CppHeader,
  ".c": EFileType.CSource,
  ".cpp": EFileType.CppSource,
  ".cxx": EFileType.CppSource,
  ".cc": EFileType.CppSource,
};

/**
 * Default ignore patterns for fast-glob
 * Issue #355: Exclude .pio/build (compiled artifacts) but allow .pio/libdeps (library headers)
 */
const DEFAULT_IGNORE_GLOBS = [
  "**/node_modules/**",
  "**/.git/**",
  "**/.build/**",
  "**/.pio/build/**",
];

/**
 * Discovers source files in directories
 */
class FileDiscovery {
  /**
   * Convert RegExp patterns to glob ignore patterns
   */
  private static regexToGlob(pattern: RegExp): string {
    // Convert common patterns
    const src = pattern.source;
    if (src === "node_modules") return "**/node_modules/**";
    if (src === "\\.git") return "**/.git/**";
    if (src === "\\.build") return "**/.build/**";
    if (src === "\\.pio[/\\\\]build") return "**/.pio/build/**";
    // Fallback: wrap in wildcards
    return `**/*${src.replace(/\\/g, "")}*/**`;
  }

  /**
   * Classify a file path into a discovered file
   */
  private static classifyFile(filePath: string): IDiscoveredFile {
    const ext = extname(filePath).toLowerCase();
    const type = EXTENSION_MAP[ext] ?? EFileType.Unknown;
    return {
      path: filePath,
      type,
      extension: ext,
    };
  }

  /**
   * Discover files in the given directories
   *
   * Issue #331: Uses fast-glob's unique option to avoid duplicates
   * when overlapping directories are provided.
   */
  static discover(
    directories: string[],
    options: IDiscoveryOptions = {},
  ): IDiscoveredFile[] {
    const recursive = options.recursive ?? true;
    const extensions = options.extensions ?? Object.keys(EXTENSION_MAP);

    // Build ignore patterns
    let ignorePatterns: string[];
    if (options.excludePatterns) {
      ignorePatterns = options.excludePatterns.map((r) => this.regexToGlob(r));
    } else {
      ignorePatterns = DEFAULT_IGNORE_GLOBS;
    }

    // Build glob pattern for extensions
    const extPattern =
      extensions.length === 1
        ? `*${extensions[0]}`
        : `*{${extensions.join(",")}}`;
    const pattern = recursive ? `**/${extPattern}` : extPattern;

    const allFiles: IDiscoveredFile[] = [];

    for (const dir of directories) {
      const resolvedDir = resolve(dir);

      if (!existsSync(resolvedDir)) {
        console.warn(`Warning: Directory not found: ${dir}`);
        continue;
      }

      try {
        // Use fast-glob to find files
        const files = fg.sync(pattern, {
          cwd: resolvedDir,
          absolute: true,
          ignore: ignorePatterns,
          deep: recursive ? Infinity : 1,
          onlyFiles: true,
          followSymbolicLinks: false,
        });

        for (const file of files) {
          allFiles.push(this.classifyFile(file));
        }
      } catch (err) {
        console.warn(`Warning: Cannot read directory: ${dir}`);
      }
    }

    // Issue #331: Remove duplicates from overlapping directories
    const seenPaths = new Set<string>();
    return allFiles.filter((file) => {
      if (seenPaths.has(file.path)) {
        return false;
      }
      seenPaths.add(file.path);
      return true;
    });
  }

  /**
   * Discover a single file
   */
  static discoverFile(filePath: string): IDiscoveredFile | null {
    const resolvedPath = resolve(filePath);

    if (!existsSync(resolvedPath)) {
      return null;
    }

    try {
      const stats = statSync(resolvedPath);
      if (!stats.isFile()) {
        return null;
      }
    } catch {
      return null;
    }

    return this.classifyFile(resolvedPath);
  }

  /**
   * Discover multiple specific files
   */
  static discoverFiles(filePaths: string[]): IDiscoveredFile[] {
    const files: IDiscoveredFile[] = [];

    for (const filePath of filePaths) {
      const file = this.discoverFile(filePath);
      if (file) {
        files.push(file);
      } else {
        console.warn(`Warning: File not found: ${filePath}`);
      }
    }

    return files;
  }

  /**
   * Filter discovered files by type
   */
  static filterByType(
    files: IDiscoveredFile[],
    type: EFileType,
  ): IDiscoveredFile[] {
    return files.filter((f) => f.type === type);
  }

  /**
   * Get C-Next files from a list
   */
  static getCNextFiles(files: IDiscoveredFile[]): IDiscoveredFile[] {
    return this.filterByType(files, EFileType.CNext);
  }

  /**
   * Get C/C++ header files from a list
   */
  static getHeaderFiles(files: IDiscoveredFile[]): IDiscoveredFile[] {
    return files.filter(
      (f) => f.type === EFileType.CHeader || f.type === EFileType.CppHeader,
    );
  }
}

export default FileDiscovery;
