import PrimitiveKindUtils from "./PrimitiveKindUtils";
import type TSymbol from "../types/symbols/TSymbol";
import type TType from "../types/TType";

/**
 * #1975 review: the C-Next type a chain's head names (`u32`, `Point`,
 * `Geo.Box`, `EMode`) -- one decision, which the typer and 1.4's constant
 * folding both read. A header's struct extends it only in a pass that reads
 * headers.
 */
class TypeHead {
  /** A primitive type keyword; `void` names no type a value has */
  static primitive(name: string): TType | null {
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
}

export default TypeHead;
