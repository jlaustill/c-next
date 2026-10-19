import type IAtomicAccess from "../../types/IAtomicAccess";
import invariant from "../../utils/invariant";
import TYPE_WIDTH from "../../types/TYPE_WIDTH";
import ClampTypes from "./ClampTypes";
import FloatBitType from "./FloatBitType";
import TYPE_MAP from "./types/TYPE_MAP";

/**
 * ADR-049 (#1807, #2155 review 8): the C type a retry loop holds an atomic
 * write's value in (`__operand`), decided once in 2.2 for every atomic write,
 * so hoisting the value narrows nothing the inline form would not (#2120
 * review 2).
 */
class AtomicOperandType {
  /**
   * A bit, bit-range or bitmap-field write: one bit is a `bool`; a float's
   * bits are its bits' unsigned integer; wider bits keep the value's own C
   * type, as the inline form does (`valueCType`), or the atomic's when the
   * value has none.
   */
  static ofBits(
    access: IAtomicAccess,
    oneBit: boolean,
    floating: boolean,
    valueCType: string | null,
  ): string {
    if (oneBit) return "bool";
    if (floating) {
      invariant(access.typeName !== null, "a float is a C-Next type");
      return FloatBitType.of(access.typeName);
    }
    return valueCType ?? access.cType;
  }

  /**
   * A compound write: a clamp helper's `b` is its wider type (`ClampTypes`,
   * #94: `cnx_clamp_add_u8(0, 256)` must give 255), and a wider float value
   * keeps its own precision, as `f32 += f64` does. Any other value takes the
   * atomic's type: a wrap or bitwise narrowing is modular, so the result is
   * the same.
   */
  static ofCompound(
    access: IAtomicAccess,
    clampType: string | null,
    valueType: string | null,
  ): string {
    if (clampType !== null) {
      return ClampTypes.resolve(clampType)?.widerType ?? access.cType;
    }
    const accessedWidth =
      access.typeName === null ? undefined : TYPE_WIDTH[access.typeName];
    const isWiderFloat =
      valueType?.startsWith("f") === true &&
      accessedWidth !== undefined &&
      (TYPE_WIDTH[valueType] ?? 0) > accessedWidth;
    return isWiderFloat ? TYPE_MAP[valueType] : access.cType;
  }
}

export default AtomicOperandType;
