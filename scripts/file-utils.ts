/**
 * Shared file utilities for scripts
 */

import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Recursively find all files matching a pattern in a directory
 *
 * @param dir - Directory to search
 * @param pattern - File extension pattern (e.g., ".test.cnx")
 * @returns Array of full paths to matching files
 */
function findFilesRecursively(dir: string, pattern: string): string[] {
  const files: string[] = [];

  function walk(currentDir: string): void {
    const entries = readdirSync(currentDir);

    for (const entry of entries) {
      const fullPath = join(currentDir, entry);
      const stat = statSync(fullPath);

      if (stat.isDirectory()) {
        walk(fullPath);
      } else if (entry.endsWith(pattern)) {
        files.push(fullPath);
      }
    }
  }

  walk(dir);
  return files;
}

/**
 * Find all .test.cnx files in a directory
 */
function findTestFiles(dir: string): string[] {
  return findFilesRecursively(dir, ".test.cnx");
}

const fileUtils = {
  findFilesRecursively,
  findTestFiles,
};

export default fileUtils;
