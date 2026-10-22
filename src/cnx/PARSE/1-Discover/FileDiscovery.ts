/**
 * File Discovery
 * Classifies source files by type
 */

import { resolve } from "node:path";
import IDiscoveredFile from "./types/IDiscoveredFile";
import IFileSystem from "../../types/IFileSystem";
import FileKinds from "../../utils/FileKinds";

/**
 * Default extensions for each file type
 */

/**
 * Classifies and discovers source files
 */
class FileDiscovery {
  /**
   * Classify a file path into a discovered file, by its extension alone --
   * nothing is read, so the path need not exist.
   *
   * Whether it is cnx is `CnxSourcePath`'s answer, which is case-
   * sensitive (#1833); the C and C++ extensions are looked up lowercased.
   */
  static classifyFile(filePath: string): IDiscoveredFile {
    return {
      path: filePath,
      type: FileKinds.of(filePath),
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
