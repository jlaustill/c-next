/**
 * Test helpers for C++ collector tests.
 */

import HeaderParser from "../../../parser/HeaderParser";
import { TranslationUnitContext } from "../../../parser/cpp/grammar/CPP14Parser";

/**
 * Parse C++ source code and return the translation unit context.
 */
function parseCpp(source: string): TranslationUnitContext | null {
  const result = HeaderParser.parseCpp(source);
  return result.tree;
}

class TestHelpers {
  static readonly parseCpp = parseCpp;
}

export default TestHelpers;
