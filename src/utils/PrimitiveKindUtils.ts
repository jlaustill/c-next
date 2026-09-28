import TPrimitiveKind from "../transpiler/types/TPrimitiveKind";

/**
 * Utility functions for working with C-Next primitive types.
 */
class PrimitiveKindUtils {
  /**
   * The C-Next primitive type names. A name set, not a width table (#1760
   * review): the widths here were read by nothing but their own tests, and
   * gave `bool` 1 where TYPE_WIDTH, the one width table, gives 8.
   */
  private static readonly PRIMITIVES: ReadonlySet<string> = new Set<string>([
    "bool",
    "u8",
    "i8",
    "u16",
    "i16",
    "u32",
    "i32",
    "u64",
    "i64",
    "f32",
    "f64",
    "void",
  ]);

  static isPrimitive(type: string): type is TPrimitiveKind {
    return PrimitiveKindUtils.PRIMITIVES.has(type);
  }
}

export default PrimitiveKindUtils;
