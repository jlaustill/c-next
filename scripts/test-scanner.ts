/**
 * Scanner for test files
 * Extracts coverage annotations from .test.cnx files
 */

import { readFileSync } from "node:fs";
import { relative } from "node:path";
import ITestAnnotation from "./types/ITestAnnotation";
import fileUtils from "./file-utils";

/**
 * Extract coverage annotations from a single test file
 * Looks for: /\* test-coverage: ID *\/
 */
function extractAnnotations(
  content: string,
  filePath: string,
  testsDir: string,
): ITestAnnotation[] {
  const annotations: ITestAnnotation[] = [];
  const lines = content.split("\n");

  // Pattern: /* test-coverage: ID */ or /* test-coverage: ID1, ID2 */
  const pattern = /\/\*\s*test-coverage:\s*([^*]+)\s*\*\//g;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let match;

    while ((match = pattern.exec(line)) !== null) {
      // Handle comma-separated IDs in a single annotation
      const ids = match[1].split(",").map((id) => id.trim());

      for (const coverageId of ids) {
        if (coverageId) {
          annotations.push({
            coverageId,
            testFile: filePath,
            relativePath: relative(testsDir, filePath),
            lineNumber: i + 1,
          });
        }
      }
    }

    // Reset regex lastIndex for next line
    pattern.lastIndex = 0;
  }

  return annotations;
}

/**
 * Scan all test files and extract coverage annotations
 */
function scanTestFiles(testsDir: string): ITestAnnotation[] {
  const annotations: ITestAnnotation[] = [];
  const testFiles = fileUtils.findTestFiles(testsDir);

  for (const file of testFiles) {
    try {
      const content = readFileSync(file, "utf-8");
      const fileAnnotations = extractAnnotations(content, file, testsDir);
      annotations.push(...fileAnnotations);
    } catch (err) {
      console.error(`Warning: Could not read ${file}: ${err}`);
    }
  }

  return annotations;
}

const testScanner = {
  scanTestFiles,
  // Re-export from file-utils for backwards compatibility
  findTestFiles: fileUtils.findTestFiles,
  extractAnnotations,
};

export default testScanner;
