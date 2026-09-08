/**
 * Reading a declared type as WRITTEN, before any resolution.
 *
 * #1322: pass 2.1 handles type texts constantly -- `u8[4]`, `Color`,
 * `this.Mode`, `string<16>` -- and three analyzers had each written
 * `text.replace(/\[.*$/, "")` to get at the base name. One decision, three
 * homes, and the regex backtracks: `.*$` after a literal `[` is super-linear
 * on a long text with no closing bracket.
 *
 * Both problems have the same fix. These do the work with `indexOf` and
 * `slice`, which is linear and cannot backtrack, and they are the one place
 * the shape of a type text is interpreted.
 *
 * `OperandTypeResolver.elementType` is deliberately NOT folded in: it removes
 * ONE dimension from the middle (`u8[2][3]` -> `u8[3]`, what a subscript
 * does), which is a different question from "what is the base name".
 */
class TypeText {
  /**
   * The type without any array dimensions: `u8[4][2]` -> `u8`, `Color` ->
   * `Color`. A text with no `[` is returned unchanged.
   */
  static withoutDimensions(typeText: string): string {
    const open = typeText.indexOf("[");
    return open < 0 ? typeText : typeText.slice(0, open);
  }

  /**
   * The contents of the FIRST `[...]`, trimmed, or null when the text has no
   * complete bracket pair. `u8[4]` -> `"4"`; `u8[]` -> `""`, which is a
   * declared-but-unsized dimension and not the same as absent.
   */
  static firstDimension(typeText: string): string | null {
    const open = typeText.indexOf("[");
    if (open < 0) return null;
    const close = typeText.indexOf("]", open);
    if (close < 0) return null;
    return typeText.slice(open + 1, close).trim();
  }
}

export default TypeText;
