/**
 * ADR-058 (#1975 review 2): a length property's subject as
 * `LengthProperty.rule` asks about it, read off the typer's property step.
 * 2.1 judges it, 2.2 plans it and 2.3 writes it from this one reading.
 */
import OperandTyper from "./OperandTyper";
import LengthProperty from "./LengthProperty";
import ForeignTypeFacts from "./ForeignTypeFacts";
import type TSymbol from "../types/symbols/TSymbol";
import type IForeignSymbolLookup from "../types/IForeignSymbolLookup";
import type IChainStep from "../types/IChainStep";
import type IOperandType from "../types/IOperandType";
import type ILengthSubject from "./types/ILengthSubject";

/** Whether a C type name is a struct: a cnx one, or a header's */
type TIsStruct = (typeName: string) => boolean;

class LengthSubject {
  /** The subject of a property step; null when the typer could not type it */
  static of(step: IChainStep, isStruct: TIsStruct): ILengthSubject | null {
    const typed = step.before;
    if (typed === null) return null;
    const isArray = typed.dimensions.length > 0;
    return {
      namesType: step.beforeNamesType,
      category: typed.category,
      isString: !isArray && OperandTyper.isString(typed),
      isArray,
      isStruct: !isArray && typed.typeName !== null && isStruct(typed.typeName),
      isBitField: step.beforeIsBitField,
      spelling: LengthSubject.spelling(typed),
    };
  }

  /**
   * ADR-058's structs, which count their fields (#1535): a cnx struct, or
   * a header's whose fields cnx counts -- not a union (#1975 review)
   */
  static structTest(
    lookup: (cName: string) => TSymbol | undefined,
    headers: IForeignSymbolLookup | null,
  ): TIsStruct {
    return (typeName) =>
      LengthProperty.struct(typeName, lookup) !== undefined ||
      (headers !== null &&
        ForeignTypeFacts.fieldCount(typeName, headers) !== null);
  }

  /** A subject as a message names it, and `.type_char_count` counts: `u32`, `u8[4]` */
  static spelling(typed: IOperandType): string {
    const dimensions = typed.dimensions.map((d) => `[${d}]`).join("");
    return `${typed.typeName ?? typed.cType ?? typed.category}${dimensions}`;
  }
}

export default LengthSubject;
