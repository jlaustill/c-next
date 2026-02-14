/**
 * Test helpers for C collector tests.
 */

import HeaderParser from "../../../parser/HeaderParser";
import { CompilationUnitContext } from "../../../parser/c/grammar/CParser";

/**
 * Parse C source code and return the compilation unit context.
 */
function parseC(source: string): CompilationUnitContext | null {
  const result = HeaderParser.parseC(source);
  return result.tree;
}

class TestHelpers {
  static readonly parseC = parseC;
}

export default TestHelpers;
