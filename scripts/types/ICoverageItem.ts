/**
 * Represents a single coverage item parsed from coverage.md
 */
interface ICoverageItem {
  /** Generated unique ID (e.g., "1.1-u8-global-variable-declaration") */
  id: string;

  /** Main section (e.g., "1. Primitive Types") */
  section: string;

  /** Subsection (e.g., "1.1 Unsigned Integers") */
  subsection: string;

  /** Type header if applicable (e.g., "u8", "u16") */
  typeHeader?: string;

  /** Context/description from table (e.g., "Global variable declaration") */
  context: string;

  /** Whether checked [x] or unchecked [ ] in coverage.md */
  tested: boolean;

  /** Test file referenced in coverage.md (if any) */
  testFile?: string;

  /** Line number in coverage.md for reference */
  lineNumber: number;

  /** Whether this is an error test (marked with **(ERROR)**) */
  isErrorTest: boolean;
}

export default ICoverageItem;
