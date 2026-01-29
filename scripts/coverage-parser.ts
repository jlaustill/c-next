/**
 * Parser for coverage.md
 * Extracts all coverage items with generated unique IDs
 */

import { readFileSync } from "node:fs";
import ICoverageItem from "./types/ICoverageItem";

/**
 * Normalize a string to kebab-case for ID generation
 */
function toKebabCase(str: string): string {
  return str
    .toLowerCase()
    .replaceAll(/\*\*\(error\)\*\*/gi, "") // Remove error marker
    .replaceAll(/[^a-z0-9]+/g, "-") // Replace non-alphanumeric with hyphens
    .replaceAll(/^-+|-+$/g, "") // Trim leading/trailing hyphens
    .replaceAll(/-+/g, "-"); // Collapse multiple hyphens
}

/**
 * Extract section number from heading (e.g., "## 1. Primitive Types" -> "1")
 */
function extractSectionNumber(heading: string): string {
  const match = heading.match(/^##\s*(\d+)\./);
  return match ? match[1] : "";
}

/**
 * Extract subsection number from heading (e.g., "### 1.1 Unsigned Integers" -> "1")
 */
function extractSubsectionNumber(heading: string): string {
  const match = heading.match(/^###\s*\d+\.(\d+)/);
  return match ? match[1] : "";
}

/**
 * Extract section title (e.g., "## 1. Primitive Types" -> "1. Primitive Types")
 */
function extractSectionTitle(heading: string): string {
  const match = heading.match(/^##\s*(.+)$/);
  return match ? match[1].trim() : "";
}

/**
 * Extract subsection title (e.g., "### 1.1 Unsigned Integers" -> "1.1 Unsigned Integers")
 */
function extractSubsectionTitle(heading: string): string {
  const match = heading.match(/^###\s*(.+)$/);
  return match ? match[1].trim() : "";
}

/**
 * Extract type header (e.g., "#### u8" -> "u8")
 */
function extractTypeHeader(heading: string): string {
  const match = heading.match(/^####\s*(\S+)/);
  return match ? match[1].trim() : "";
}

/**
 * Generate a unique coverage ID
 */
function generateCoverageId(
  sectionNum: string,
  subsectionNum: string,
  typeHeader: string | undefined,
  context: string,
): string {
  const contextKebab = toKebabCase(context);

  if (typeHeader) {
    return `${sectionNum}.${subsectionNum}-${typeHeader.toLowerCase()}-${contextKebab}`;
  }
  return `${sectionNum}.${subsectionNum}-${contextKebab}`;
}

/**
 * Parse a table row and extract coverage item data
 * Expected format: | Context | [x] or [ ] | `test-file.test.cnx` |
 */
function parseTableRow(
  line: string,
  sectionNum: string,
  section: string,
  subsectionNum: string,
  subsection: string,
  typeHeader: string | undefined,
  lineNumber: number,
): ICoverageItem | null {
  // Split by | and filter empty parts
  const parts = line
    .split("|")
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  if (parts.length < 2) return null;

  const context = parts[0];
  const statusCell = parts[1];

  // Skip header row (contains "Status" or dashes)
  if (
    statusCell.toLowerCase() === "status" ||
    statusCell.match(/^-+$/) ||
    context.match(/^-+$/)
  ) {
    return null;
  }

  // Check for [x] or [ ]
  const tested = statusCell.includes("[x]");
  const isUntested = statusCell.includes("[ ]");

  if (!tested && !isUntested) return null;

  // Extract test file if present (third column, backtick-wrapped)
  let testFile: string | undefined;
  if (parts.length >= 3) {
    const testFileMatch = parts[2].match(/`([^`]+)`/);
    if (testFileMatch) {
      testFile = testFileMatch[1];
    }
  }

  // Check for error test marker
  const isErrorTest = context.includes("**(ERROR)**");
  const cleanContext = context.replaceAll(/\*\*\(ERROR\)\*\*/g, "").trim();

  const id = generateCoverageId(
    sectionNum,
    subsectionNum,
    typeHeader,
    cleanContext,
  );

  return {
    id,
    section,
    subsection,
    typeHeader,
    context: cleanContext,
    tested,
    testFile,
    lineNumber,
    isErrorTest,
  };
}

/**
 * Sections to skip during parsing
 */
const SKIP_SECTIONS = [
  "Table of Contents",
  "How to Use This Document",
  "Recent Updates",
  "Statistics",
  "Priority Summary",
  "Coverage by Test File",
];

/**
 * Check if we're in a section that should be skipped
 */
function shouldSkipSection(sectionTitle: string): boolean {
  return SKIP_SECTIONS.some(
    (skip) =>
      sectionTitle.toLowerCase().includes(skip.toLowerCase()) ||
      skip.toLowerCase().includes(sectionTitle.toLowerCase()),
  );
}

/**
 * Parse the coverage.md file and extract all coverage items
 */
function parseCoverageDocument(filePath: string): ICoverageItem[] {
  const content = readFileSync(filePath, "utf-8");
  const lines = content.split("\n");
  const items: ICoverageItem[] = [];

  let currentSection = "";
  let currentSectionNum = "";
  let currentSubsection = "";
  let currentSubsectionNum = "";
  let currentTypeHeader: string | undefined;
  let inSkipSection = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNumber = i + 1;

    // Track main section (## N. Title)
    if (line.match(/^##\s+\d+\./)) {
      currentSection = extractSectionTitle(line);
      currentSectionNum = extractSectionNumber(line);
      currentSubsection = "";
      currentSubsectionNum = "";
      currentTypeHeader = undefined;
      inSkipSection = shouldSkipSection(currentSection);
      continue;
    }

    // Track non-numbered sections (skip them)
    if (line.match(/^##\s+[^0-9]/)) {
      const title = extractSectionTitle(line);
      inSkipSection = shouldSkipSection(title);
      currentSection = "";
      currentSectionNum = "";
      continue;
    }

    if (inSkipSection) continue;

    // Track subsection (### N.N Title)
    if (line.match(/^###\s+\d+\.\d+/)) {
      currentSubsection = extractSubsectionTitle(line);
      currentSubsectionNum = extractSubsectionNumber(line);
      currentTypeHeader = undefined;
      continue;
    }

    // Track type header (#### type)
    if (line.match(/^####\s+\w+/)) {
      currentTypeHeader = extractTypeHeader(line);
      continue;
    }

    // Parse table rows with checkboxes
    if (line.includes("|") && (line.includes("[x]") || line.includes("[ ]"))) {
      if (!currentSection || !currentSubsection) continue;

      const item = parseTableRow(
        line,
        currentSectionNum,
        currentSection,
        currentSubsectionNum,
        currentSubsection,
        currentTypeHeader,
        lineNumber,
      );

      if (item) {
        items.push(item);
      }
    }
  }

  return items;
}

/**
 * Check for duplicate IDs and log warnings
 */
function checkForDuplicates(items: ICoverageItem[]): Map<string, number[]> {
  const idMap = new Map<string, number[]>();

  for (const item of items) {
    const existing = idMap.get(item.id);
    if (existing) {
      existing.push(item.lineNumber);
    } else {
      idMap.set(item.id, [item.lineNumber]);
    }
  }

  const duplicates = new Map<string, number[]>();
  for (const [id, lines] of idMap) {
    if (lines.length > 1) {
      duplicates.set(id, lines);
    }
  }

  return duplicates;
}

const coverageParser = {
  parseCoverageDocument,
  checkForDuplicates,
  generateCoverageId,
  toKebabCase,
};

export default coverageParser;
