import TPrimitiveKind from "../transpiler/types/TPrimitiveKind";

/**
 * Utility functions for working with C-Next primitive types.
 */
class PrimitiveKindUtils {
  static readonly BIT_WIDTHS: ReadonlyMap<TPrimitiveKind, number> = new Map([
    ["bool", 1],
    ["u8", 8],
    ["i8", 8],
    ["u16", 16],
    ["i16", 16],
    ["u32", 32],
    ["i32", 32],
    ["u64", 64],
    ["i64", 64],
    ["f32", 32],
    ["f64", 64],
  ]);

  static getBitWidth(kind: TPrimitiveKind): number | undefined {
    return PrimitiveKindUtils.BIT_WIDTHS.get(kind);
  }

  /**
   * The integer type of a composite expression: the WIDEST operand's width,
   * carrying the FIRST typed operand's signedness.
   *
   * #1450: derived identically in two layers, and nothing tied them together.
   * `IntegerConversionAnalyzer` (2.1 Analyze) uses it to decide whether a
   * conversion is reportable; `TypeResolver` (2.3 Render) uses it to decide
   * what C to emit. Same rule, two copies -- so a change to how a composite
   * widens would have to be made twice, in two layers, and a miss would leave
   * the diagnostic judging one rule while codegen emitted another. That
   * disagreement produces no failure anywhere: each side is internally
   * consistent.
   *
   * The two cannot share it by importing one another -- `output/` reaching
   * `1-Analyze/` is an error-severity depcruise rule, written to force such
   * edges "to be resolved rather than carried across at a new path". So the
   * rule lives here, where both already reach, and each caller keeps its own
   * way of enumerating and typing operands.
   *
   * Operands it cannot type are skipped rather than failing the whole
   * expression: a literal is contextually typed and has no width of its own.
   * Null when nothing typed at all.
   *
   * ## One of the two rules here is unexercised, and it is not the obvious one
   *
   * Taking the NARROWEST width instead of the widest reddens 10 of 1247
   * fixtures, so that half is pinned. Taking the LAST operand's signedness
   * instead of the first reddens **none**.
   *
   * Not because the line is unreached: a probe firing on any second typed
   * operand fires repeatedly, always `u+u`. A probe firing only when two
   * operands DISAGREE never fires at all. So the corpus contains no composite
   * whose operands differ in signedness, and `??=` versus `=` cannot be told
   * apart by it.
   *
   * The rule is kept as both copies had it, rather than simplified to whatever
   * the tests happen to allow. Recorded here so the next person to mutate it
   * gets the same green and knows it means "no fixture covers this", not
   * "this does not matter".
   *
   * @param operandTypes each operand's type, in source order; nulls allowed
   */
  static widestIntegerOf(operandTypes: Iterable<string | null>): string | null {
    let category: "i" | "u" | null = null;
    let width = 0;
    for (const operandType of operandTypes) {
      const match = operandType
        ? /^([iu])(8|16|32|64)$/.exec(operandType)
        : null;
      if (!match) continue;
      category ??= match[1] as "i" | "u";
      width = Math.max(width, Number.parseInt(match[2], 10));
    }
    return category && width > 0 ? `${category}${width}` : null;
  }

  static isPrimitive(type: string): type is TPrimitiveKind {
    return (
      PrimitiveKindUtils.BIT_WIDTHS.has(type as TPrimitiveKind) ||
      type === "void"
    );
  }
}

export default PrimitiveKindUtils;
