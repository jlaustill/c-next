/**
 * What an element type's width in bits is read from, beside the primitive
 * table: the program's enums and bitmaps (ADR-058). Render answers from its
 * per-file view, 1.4 from the symbols it settles -- the same facts.
 */
interface IElementWidthFacts {
  /** A C enum's declared width (a typed C enum, #208); null when it has none */
  enumBitWidth(typeName: string): number | null;
  /** Whether the name is a C-Next enum, which ADR-017 makes 32 bits wide */
  isEnum(typeName: string): boolean;
  /** A bitmap's width; null for anything else */
  bitmapBitWidth(typeName: string): number | null;
}

export default IElementWidthFacts;
