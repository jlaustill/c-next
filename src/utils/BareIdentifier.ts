/**
 * BareIdentifier - is this rendered text one identifier, or an expression?
 *
 * Codegen and the analyzers both work with text that has already been rendered
 * or lifted out of the parse tree, and both repeatedly need the same thing
 * before they can treat it as a name: proof that it IS a name. `person.name`,
 * `a + b`, `"literal"` and `f()` all arrive as strings in the same slot as
 * `count`, and only the last one can be handed to a symbol lookup.
 *
 * The test was written out five times -- `CodeGenerator` and `EnumTypeResolver`
 * inline, `NullCheckAnalyzer` inline in pass 2.1, and `StringOperationsHelper`
 * and `ArrayDimensionParser` each as a private constant under a DIFFERENT name
 * (`IDENTIFIER_REGEX`, `IDENTIFIER_RE`). Two independent namings of one
 * predicate is the tell that it kept being re-derived rather than found.
 *
 * It lives in `utils/` because it has to: `output/` may not import
 * `1-Analyze` -- depcruise makes that edge an error, transitively -- and three
 * of the five sites sit on opposite sides of that line. `PrimitiveKindUtils`
 * holds `widestIntegerOf` for the same reason.
 *
 * NOT a validity check for a name a user may declare. `ReservedCnxName` owns
 * that, and it rejects names this accepts (`cnx_tmp0` matches here and is
 * E0202 there). This answers only "is this text shaped like a single
 * identifier", which is what a caller needs before asking anyone about it.
 */
class BareIdentifier {
  /**
   * The C identifier shape: a letter or underscore, then word characters.
   *
   * Deliberately not anchored to the grammar's IDENTIFIER token at runtime --
   * every caller holds text, not a token, and the point is to reject text that
   * was never one identifier to begin with.
   */
  private static readonly SHAPE = /^[a-zA-Z_]\w*$/;

  /**
   * True when `text` is exactly one identifier, with nothing else in it.
   */
  static matches(text: string): boolean {
    return BareIdentifier.SHAPE.test(text);
  }
}

export default BareIdentifier;
