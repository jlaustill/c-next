/**
 * File Discovery
 * Classifies source files by type
 */

import { extname, resolve } from "node:path";
import EFileType from "./types/EFileType";
import IDiscoveredFile from "./types/IDiscoveredFile";
import IFileSystem from "../../types/IFileSystem";
import CNextSourcePath from "../../utils/CNextSourcePath";

/**
 * Default extensions for each file type
 */
const EXTENSION_MAP: Record<string, EFileType> = {
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
   *
   * Whether it is C-Next is `CNextSourcePath`'s answer, which is case-
   * sensitive (#1833); the C and C++ extensions are looked up lowercased.
   */
  static classifyFile(filePath: string): IDiscoveredFile {
    const ext = extname(filePath).toLowerCase();
    return {
      path: filePath,
      type: FileDiscovery._typeOf(filePath, ext),
    };
  }

  private static _typeOf(filePath: string, ext: string): EFileType {
    if (CNextSourcePath.isSource(filePath)) return EFileType.CNext;
    if (CNextSourcePath.isMiscased(filePath)) return EFileType.MiscasedCNext;
    return EXTENSION_MAP[ext] ?? EFileType.Unknown;
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
