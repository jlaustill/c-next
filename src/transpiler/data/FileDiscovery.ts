/**
 * File Discovery
 * Scans directories for source files
 */

import { join, extname, resolve } from "node:path";
import EFileType from "./types/EFileType";
import IDiscoveredFile from "./types/IDiscoveredFile";
import IDiscoveryOptions from "./types/IDiscoveryOptions";
import IFileSystem from "../types/IFileSystem";
import NodeFileSystem from "../NodeFileSystem";

/** Default file system instance (singleton for performance) */
const defaultFs = NodeFileSystem.instance;

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
 * Discovers source files in directories
 */
class FileDiscovery {
  /**
   * Discover files in the given directories
   *
   * Issue #331: Uses a Set to track discovered file paths and avoid duplicates
   * when overlapping directories are provided (e.g., both src/Display and src).
   *
   * @param directories - Directories to scan
   * @param options - Discovery options
   * @param fs - File system abstraction (defaults to NodeFileSystem)
   */
  static discover(
    directories: string[],
    options: IDiscoveryOptions = {},
    fs: IFileSystem = defaultFs,
  ): IDiscoveredFile[] {
    const files: IDiscoveredFile[] = [];
    const recursive = options.recursive ?? true;
    // Issue #355: Exclude .pio/build (compiled artifacts) but allow .pio/libdeps (library headers)
    // Previously excluded all of .pio/, which prevented PlatformIO library headers from being parsed
    const excludePatterns = options.excludePatterns ?? [
      /node_modules/,
      /\.git/,
      /\.build/,
      /\.pio[/\\]build/,
    ];
    // Issue #331: Track discovered paths to avoid duplicates from overlapping dirs
    const discoveredPaths = new Set<string>();

    for (const dir of directories) {
      const resolvedDir = resolve(dir);

      if (!fs.exists(resolvedDir)) {
        console.warn(`Warning: Directory not found: ${dir}`);
        continue;
      }

      this.scanDirectory(
        resolvedDir,
        files,
        recursive,
        options.extensions,
        excludePatterns,
        discoveredPaths,
        fs,
      );
    }

    return files;
  }

  /**
   * Discover a single file
   *
   * @param filePath - Path to the file
   * @param fs - File system abstraction (defaults to NodeFileSystem)
   */
  static discoverFile(
    filePath: string,
    fs: IFileSystem = defaultFs,
  ): IDiscoveredFile | null {
    const resolvedPath = resolve(filePath);

    if (!fs.exists(resolvedPath)) {
      return null;
    }

    const ext = extname(resolvedPath).toLowerCase();
    const type = EXTENSION_MAP[ext] ?? EFileType.Unknown;

    return {
      path: resolvedPath,
      type,
      extension: ext,
    };
  }

  /**
   * Discover multiple specific files
   *
   * @param filePaths - Paths to the files
   * @param fs - File system abstraction (defaults to NodeFileSystem)
   */
  static discoverFiles(
    filePaths: string[],
    fs: IFileSystem = defaultFs,
  ): IDiscoveredFile[] {
    const files: IDiscoveredFile[] = [];

    for (const filePath of filePaths) {
      const file = this.discoverFile(filePath, fs);
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

  /**
   * Scan a directory for source files
   *
   * Issue #331: discoveredPaths parameter tracks already-discovered files
   * to avoid duplicates when scanning overlapping directories.
   */
  private static scanDirectory(
    dir: string,
    files: IDiscoveredFile[],
    recursive: boolean,
    extensions: string[] | undefined,
    excludePatterns: RegExp[],
    discoveredPaths: Set<string>,
    fs: IFileSystem,
  ): void {
    let entries: string[];

    try {
      entries = fs.readdir(dir);
    } catch {
      console.warn(`Warning: Cannot read directory: ${dir}`);
      return;
    }

    for (const entry of entries) {
      const fullPath = join(dir, entry);

      // Check exclude patterns
      if (excludePatterns.some((pattern) => pattern.test(fullPath))) {
        continue;
      }

      // Check if it's a directory or file
      const isDir = fs.isDirectory(fullPath);
      const isFile = fs.isFile(fullPath);

      if (isDir) {
        if (recursive) {
          this.scanDirectory(
            fullPath,
            files,
            recursive,
            extensions,
            excludePatterns,
            discoveredPaths,
            fs,
          );
        }
      } else if (isFile) {
        // Issue #331: Skip already-discovered files (from overlapping directories)
        if (discoveredPaths.has(fullPath)) {
          continue;
        }

        const ext = extname(fullPath).toLowerCase();

        // Check extension filter
        if (extensions && !extensions.includes(ext)) {
          continue;
        }

        const type = EXTENSION_MAP[ext];
        if (type) {
          discoveredPaths.add(fullPath);
          files.push({
            path: fullPath,
            type,
            extension: ext,
          });
        }
      }
    }
  }
}

export default FileDiscovery;
