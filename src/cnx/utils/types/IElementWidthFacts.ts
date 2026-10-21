/**
 * What an element type's width in bits is read from, beside the primitive
 * table: the program's enums and bitmaps (ADR-058). Render answers from its
 * per-file view, 1.4 from the symbols it settles -- the same facts.
 */
interface IElementWidthFacts {
  /** A C enum's declared width (a typed C enum, #208); null when it has none */
  enumBitWidth(typeName: string): number | null;
  /** A cnx enum's fewest bits for its members (`LengthProperty.enumBits`); null for any other */
  enumBits(typeName: string): number | null;
  /** A bitmap's width; null for anything else */
  bitmapBitWidth(typeName: string): number | null;
}

export default IElementWidthFacts;
