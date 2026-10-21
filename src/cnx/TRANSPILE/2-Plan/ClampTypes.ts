import TYPE_MAP from "./types/TYPE_MAP";
import WIDER_TYPE_MAP from "./types/WIDER_TYPE_MAP";
import TYPE_LIMITS from "./types/TYPE_LIMITS";
import type IClampTypeInfo from "./types/IClampTypeInfo";

/** The C types an overflow helper for a cnx type is written in */
class ClampTypes {
  /**
   * Resolve type information for a cnx type
   */
  static resolve(cnxType: string): IClampTypeInfo | null {
    const cType = TYPE_MAP[cnxType];
    const widerType = WIDER_TYPE_MAP[cnxType] || cType;
    const maxValue = TYPE_LIMITS.TYPE_MAX[cnxType];
    const minValue = TYPE_LIMITS.TYPE_MIN[cnxType];

    if (!cType || !maxValue) {
      return null;
    }

    const isUnsigned = cnxType.startsWith("u");
    // For signed types narrower than i64, use wider arithmetic to avoid UB (Issue #94)
    const useWiderArithmetic =
      !isUnsigned && widerType !== cType && cnxType !== "i64";

    return {
      cType,
      widerType,
      maxValue,
      minValue,
      cnxType,
      isUnsigned,
      useWiderArithmetic,
    };
  }

  /**
   * The C types a clamp helper for `cnxType` spells -- its own and its wider
   * arithmetic type -- so the plan can decide their header (#1927)
   */
  static cTypesOf(cnxType: string): string[] {
    const info = ClampTypes.resolve(cnxType);
    return info === null ? [] : [info.cType, info.widerType];
  }
}

export default ClampTypes;
