import type IAtomicAccess from "../../types/IAtomicAccess";
import type IExclusiveAccess from "../types/IExclusiveAccess";
import LDREX_MAP from "./types/LDREX_MAP";
import STREX_MAP from "./types/STREX_MAP";
import TYPE_MAP from "./types/TYPE_MAP";

/**
 * ADR-049: whether an atomic value takes an LDREX/STREX loop, and through
 * which pointer. Only a value whose C type is the intrinsic's pointee, or
 * its same-width signed twin (#2208, C11 6.5p7), can: a header typedef of
 * another C type (`size_t`, `unsigned int` where `uint32_t` is `unsigned
 * long`) would pass an incompatible pointer, so it takes the masked region
 * (#2155 review 9).
 */
class ExclusiveAccess {
  static of(access: IAtomicAccess): IExclusiveAccess | null {
    const typeName = access.typeName;
    if (typeName === null) return null;
    const ldrex = LDREX_MAP[typeName];
    const strex = STREX_MAP[typeName];
    if (ldrex === undefined || strex === undefined) return null;
    if (access.cType !== TYPE_MAP[typeName]) return null;
    return {
      ldrex,
      strex,
      pointee: TYPE_MAP[typeName.replace(/^i/, "u")],
    };
  }
}

export default ExclusiveAccess;
