/**
 * Test helpers for C++ collector tests: 1.2's lowered C++ header (#1991).
 */

import HeaderParser from "../../../2-Parse/HeaderParser";
import type ICppHeaderSyntax from "../../../2-Parse/types/ICppHeaderSyntax";

function parseCpp(source: string): ICppHeaderSyntax | null {
  return HeaderParser.parseCpp(source).syntax;
}

class TestHelpers {
  static readonly parseCpp = parseCpp;
}

export default TestHelpers;
