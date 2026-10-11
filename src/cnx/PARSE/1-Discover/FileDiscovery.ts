/**
 * File Discovery
 * Classifies source files by type
 */

import { extname, resolve } from "node:path";
import EFileType from "./types/EFileType";
import IDiscoveredFile from "./types/IDiscoveredFile";
import IFileSystem from "../../types/IFileSystem";

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
  // #1840, owner ruling 4 on #1444: GCC treats `.c++` as C++ source, and the
  // CLI already accepted it as a C++ entry point. E0503 reads this row too
  ".c++": EFileType.CppSource,
};

/**
 * Classifies and discovers source files
 */
class FileDiscovery {
  /**
   * Classify a file path into a discovered file, by its extension alone --
   * nothing is read, so the path need not exist.
   */
  static classifyFile(filePath: string): IDiscoveredFile {
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
   * @param fs - File system abstraction
   */
  static discoverFile(
    filePath: string,
    fs: IFileSystem,
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
}

export default FileDiscovery;
