import ESymbolKind from "../../../utils/types/ESymbolKind";
import IBaseSymbol from "./IBaseSymbol";
import IBitmapFieldInfo from "./IBitmapFieldInfo";

/**
 * Symbol representing a bitmap type definition.
 * Bitmaps provide named access to bit regions within an integer backing type.
 */
interface IBitmapSymbol extends IBaseSymbol {
  /** Discriminant for type narrowing */
  kind: ESymbolKind.Bitmap;

  /** Backing integer type (e.g., "u8", "u32") */
  backingType: string;

  /** Total bit width of the bitmap */
  bitWidth: number;

  /** Map of field name to bit offset/width metadata */
  fields: Map<string, IBitmapFieldInfo>;
}

export default IBitmapSymbol;
