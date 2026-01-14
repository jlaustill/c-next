"use strict";
/**
 * File Discovery
 * Scans directories for source files
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.EFileType = void 0;
const fs_1 = require("fs");
const path_1 = require("path");
/**
 * File types supported by the transpiler
 */
var EFileType;
(function (EFileType) {
  EFileType["CNext"] = "cnext";
  EFileType["CHeader"] = "c_header";
  EFileType["CppHeader"] = "cpp_header";
  EFileType["CSource"] = "c_source";
  EFileType["CppSource"] = "cpp_source";
  EFileType["Unknown"] = "unknown";
})(EFileType || (exports.EFileType = EFileType = {}));
/**
 * Default extensions for each file type
 */
const EXTENSION_MAP = {
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
   */
  static discover(directories, options = {}) {
    const files = [];
    const recursive = options.recursive ?? true;
    const excludePatterns = options.excludePatterns ?? [
      /node_modules/,
      /\.git/,
      /\.build/,
      /\.pio/,
    ];
    for (const dir of directories) {
      const resolvedDir = (0, path_1.resolve)(dir);
      if (!(0, fs_1.existsSync)(resolvedDir)) {
        console.warn(`Warning: Directory not found: ${dir}`);
        continue;
      }
      this.scanDirectory(
        resolvedDir,
        files,
        recursive,
        options.extensions,
        excludePatterns,
      );
    }
    return files;
  }
  /**
   * Discover a single file
   */
  static discoverFile(filePath) {
    const resolvedPath = (0, path_1.resolve)(filePath);
    if (!(0, fs_1.existsSync)(resolvedPath)) {
      return null;
    }
    const ext = (0, path_1.extname)(resolvedPath).toLowerCase();
    const type = EXTENSION_MAP[ext] ?? EFileType.Unknown;
    return {
      path: resolvedPath,
      type,
      extension: ext,
    };
  }
  /**
   * Discover multiple specific files
   */
  static discoverFiles(filePaths) {
    const files = [];
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
  static filterByType(files, type) {
    return files.filter((f) => f.type === type);
  }
  /**
   * Get C-Next files from a list
   */
  static getCNextFiles(files) {
    return this.filterByType(files, EFileType.CNext);
  }
  /**
   * Get C/C++ header files from a list
   */
  static getHeaderFiles(files) {
    return files.filter(
      (f) => f.type === EFileType.CHeader || f.type === EFileType.CppHeader,
    );
  }
  /**
   * Scan a directory for source files
   */
  static scanDirectory(dir, files, recursive, extensions, excludePatterns) {
    let entries;
    try {
      entries = (0, fs_1.readdirSync)(dir);
    } catch {
      console.warn(`Warning: Cannot read directory: ${dir}`);
      return;
    }
    for (const entry of entries) {
      const fullPath = (0, path_1.join)(dir, entry);
      // Check exclude patterns
      if (excludePatterns.some((pattern) => pattern.test(fullPath))) {
        continue;
      }
      let stats;
      try {
        stats = (0, fs_1.statSync)(fullPath);
      } catch {
        continue;
      }
      if (stats.isDirectory()) {
        if (recursive) {
          this.scanDirectory(
            fullPath,
            files,
            recursive,
            extensions,
            excludePatterns,
          );
        }
      } else if (stats.isFile()) {
        const ext = (0, path_1.extname)(fullPath).toLowerCase();
        // Check extension filter
        if (extensions && !extensions.includes(ext)) {
          continue;
        }
        const type = EXTENSION_MAP[ext];
        if (type) {
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
exports.default = FileDiscovery;
