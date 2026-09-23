/**
 * Test helpers for C++ collector tests.
 */

import HeaderParser from "../../../2-Parse/HeaderParser";
import { TranslationUnitContext } from "../../../2-Parse/cpp/grammar/CPP14Parser";

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
