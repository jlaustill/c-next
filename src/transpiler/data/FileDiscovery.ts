/**
 * File Discovery
 * Classifies source files by type
 */

import { extname, resolve } from "node:path";
import EFileType from "./types/EFileType";
import IDiscoveredFile from "./types/IDiscoveredFile";
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
 * Classifies and discovers source files
 */
class FileDiscovery {
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

    if (!fs.isFile(resolvedPath)) {
      return null;
    }

    return this.classifyFile(resolvedPath);
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
}

export default FileDiscovery;
