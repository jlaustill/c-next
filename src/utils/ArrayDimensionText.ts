/**
 * ArrayDimensionText - extracts array dimensions from a type or declarator
 * string.
 *
 * Issue #1127: `SymbolUtils.parseArrayDimensions` and
 * `TypeResolver.parseArrayType` each did this, and disagreed:
 *
 *   "[0x10]"   SymbolUtils "0x10"   TypeResolver 0     parseInt("0x10", 10)
 *   "[8+1]"    SymbolUtils "8+1"    TypeResolver 8     stops at '+'
 *   "[8ul]"    SymbolUtils "8ul"    TypeResolver 8     stops at 'u'
 *
 * TypeResolver's readings are not merely different, they are wrong: a 16-byte
 * array read as dimension 0, and `8+1` read as 8. Both now use this, which
 * folds through `LiteralUtils.parseIntegerLiteral` so every integer notation
 * resolves, and otherwise keeps the source text rather than truncating it.
 *
 * This is the string-level counterpart to `ArrayDimensionParser`, which works
 * from the parse tree. Two entry points exist because C and C++ declarators
 * reach the symbol layer as text, with no C-Next parse tree behind them.
 */

import LiteralUtils from "./LiteralUtils.js";

/** Matches one bracketed dimension; `[^\]]` cannot span a closing bracket. */
const DIMENSION_PATTERN = /\[([^\]]*)\]/g;

class ArrayDimensionText {
  /**
   * Extract every bracketed dimension from a type or declarator string.
   *
   * @param text e.g. "u8[10]", "buf[2][N]", "arr[BUF_SIZE]"
   * @returns One entry per dimension: a number when the text is an integer
   *          literal in any notation, otherwise the trimmed source text (a
   *          macro name, an enum count, an expression). An unsized `[]` yields
   *          the empty string, so the dimension keeps its position.
   *
   * @example parse("u8[10]")      => [10]
   * @example parse("u8[0x10]")    => [16]
   * @example parse("u8[2][N]")    => [2, "N"]
   * @example parse("u8[8+1]")     => ["8+1"]
   */
  static parse(text: string): (number | string)[] {
    const dimensions: (number | string)[] = [];
    DIMENSION_PATTERN.lastIndex = 0;

    let match: RegExpExecArray | null = DIMENSION_PATTERN.exec(text);
    while (match !== null) {
      const content = match[1].trim();
      const literal = LiteralUtils.parseIntegerLiteral(content);
      dimensions.push(literal ?? content);
      match = DIMENSION_PATTERN.exec(text);
    }

    return dimensions;
  }
}

export default ArrayDimensionText;
