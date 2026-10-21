import ForeignTypeFacts from "./ForeignTypeFacts";
import PrimitiveKindUtils from "./PrimitiveKindUtils";
import type IForeignSymbolLookup from "../types/IForeignSymbolLookup";
import type ITargetDescription from "../types/ITargetDescription";
import type TSymbol from "../types/symbols/TSymbol";
import type TType from "../types/TType";

/**
 * #1975 review: the cnx type a chain's head names (`u32`, `Point`,
 * `Geo.Box`, `EMode`) -- one decision, which the typer and 1.4's constant
 * folding both read. A header's type extends it only in a pass that reads
 * headers.
 */
class TypeHead {
  /**
   * A primitive type keyword; `void` names no type a value has. ADR-040's
   * `ISR` is a function pointer, a type with no width cnx fixes (#1975
   * review: `ISR.type_byte_length` reached the C as written).
   */
  static primitive(name: string): TType | null {
    if (name === "ISR") return { kind: "external", name };
    return PrimitiveKindUtils.isPrimitive(name) && name !== "void"
      ? { kind: "primitive", primitive: name }
      : null;
  }

  /** The struct, enum or bitmap a symbol declares under `cName` */
  static ofSymbol(symbol: TSymbol | undefined, cName: string): TType | null {
    switch (symbol?.kind) {
      case "struct":
      case "enum":
        return { kind: symbol.kind, name: cName };
      case "bitmap":
        return { kind: "bitmap", name: cName, bitWidth: symbol.bitWidth };
      default:
        return null;
    }
  }

  /**
   * #1975 review: a type a header names, or one of C's own spellings --
   * `Cfg`, `word_t`, `HE`, `uint32_t` -- for a name no cnx symbol names.
   * Its width is `ForeignTypeFacts.typeBits`'s, null where cnx fixes none.
   */
  static header(
    name: string,
    lookup: IForeignSymbolLookup,
    target: ITargetDescription | null,
  ): TType | null {
    return ForeignTypeFacts.isForeignType(name, lookup, target)
      ? { kind: "external", name }
      : null;
  }
}

export default TypeHead;
