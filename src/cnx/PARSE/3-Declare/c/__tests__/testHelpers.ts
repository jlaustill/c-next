/**
 * Test helpers for the C resolver: 1.2's lowered C header (#1991).
 */
import HeaderParser from "../../../2-Parse/HeaderParser";
import type ICHeaderSyntax from "../../../2-Parse/types/ICHeaderSyntax";

function parseC(source: string): ICHeaderSyntax | null {
  return HeaderParser.parseC(source).syntax;
}

class TestHelpers {
  static readonly parseC = parseC;
}

export default TestHelpers;
