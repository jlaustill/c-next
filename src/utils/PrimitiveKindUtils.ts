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

  static isPrimitive(type: string): type is TPrimitiveKind {
    return (
      PrimitiveKindUtils.BIT_WIDTHS.has(type as TPrimitiveKind) ||
      type === "void"
    );
  }
}

export default PrimitiveKindUtils;
