"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InputExpansion = void 0;
const path_1 = require("path");
const fs_1 = require("fs");
/**
 * Input expansion for C-Next CLI
 *
 * Expands file paths and directories into a list of .cnx files to compile.
 * Handles recursive directory scanning and file validation.
 */
class InputExpansion {
  /**
   * Expand inputs (files or directories) to list of .cnx files
   *
   * @param inputs - Array of file paths or directories
   * @returns Array of .cnx file paths
   */
  static expandInputs(inputs) {
    const files = [];
    for (const input of inputs) {
      const resolvedPath = (0, path_1.resolve)(input);
      if (!(0, fs_1.existsSync)(resolvedPath)) {
        throw new Error(`Input not found: ${input}`);
      }
      const stats = (0, fs_1.statSync)(resolvedPath);
      if (stats.isDirectory()) {
        // Recursively find .cnx files
        const cnextFiles = this.findCNextFiles(resolvedPath);
        files.push(...cnextFiles);
      } else if (stats.isFile()) {
        // Validate and add file
        this.validateFileExtension(resolvedPath);
        files.push(resolvedPath);
      }
    }
    // Remove duplicates
    return Array.from(new Set(files));
  }
  /**
   * Recursively find .cnx files in directory
   *
   * @param dir - Directory to scan
   * @returns Array of .cnx file paths
   */
  static findCNextFiles(dir) {
    const files = [];
    try {
      const entries = (0, fs_1.readdirSync)(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = (0, path_1.resolve)(dir, entry.name);
        // Skip hidden directories and common build/dependency directories
        if (entry.isDirectory()) {
          const dirName = entry.name;
          if (
            dirName.startsWith(".") ||
            dirName === "node_modules" ||
            dirName === "build" ||
            dirName === ".pio" ||
            dirName === "dist"
          ) {
            continue;
          }
          // Recursively scan subdirectory
          const subFiles = this.findCNextFiles(fullPath);
          files.push(...subFiles);
        } else if (entry.isFile()) {
          const ext = (0, path_1.extname)(entry.name);
          if (ext === ".cnx" || ext === ".cnext") {
            files.push(fullPath);
          }
        }
      }
    } catch (error) {
      throw new Error(`Failed to scan directory ${dir}: ${error}`);
    }
    return files;
  }
  /**
   * Validate file extension
   *
   * Accepts: .cnx, .cnext
   * Rejects: .c, .cpp, .cc, .cxx, .c++ (implementation files)
   *
   * @param path - File path to validate
   * @throws Error if extension is invalid
   */
  static validateFileExtension(path) {
    const ext = (0, path_1.extname)(path);
    const fileName = (0, path_1.basename)(path);
    // Reject implementation files
    const rejectedExtensions = [".c", ".cpp", ".cc", ".cxx", ".c++"];
    if (rejectedExtensions.includes(ext)) {
      throw new Error(
        `Cannot process implementation file '${fileName}'. ` +
          `C-Next only compiles .cnx files. ` +
          `If you need to include this file, create a header (.h) instead.`,
      );
    }
    // Accept C-Next source files
    const acceptedExtensions = [".cnx", ".cnext"];
    if (!acceptedExtensions.includes(ext)) {
      throw new Error(
        `Invalid file extension '${ext}' for file '${fileName}'. ` +
          `C-Next only accepts .cnx or .cnext files.`,
      );
    }
  }
}
exports.InputExpansion = InputExpansion;
