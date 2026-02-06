/**
 * Shared file scanning utilities for scripts
 */

import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Recursively find all files matching a suffix pattern
 * @param dir - Directory to search
 * @param suffix - File suffix to match (e.g., ".test.cnx")
 * @returns Array of absolute file paths
 */
function findFiles(dir: string, suffix: string): string[] {
  const files: string[] = [];

  function walk(currentDir: string): void {
    const entries = readdirSync(currentDir);

    for (const entry of entries) {
      const fullPath = join(currentDir, entry);
      const stat = statSync(fullPath);

      if (stat.isDirectory()) {
        walk(fullPath);
      } else if (entry.endsWith(suffix)) {
        files.push(fullPath);
      }
    }
  }

  walk(dir);
  return files;
}

/**
 * Find all .test.cnx files in a directory
 * Convenience wrapper for the common case
 */
function findTestFiles(dir: string): string[] {
  return findFiles(dir, ".test.cnx");
}

class FileScanner {
  static findFiles = findFiles;
  static findTestFiles = findTestFiles;
}

export default FileScanner;
