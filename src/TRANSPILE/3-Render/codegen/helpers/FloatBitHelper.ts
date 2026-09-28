/**
 * FloatBitHelper - Generates float bit write operations using union-based type punning
 *
 * Issue #644: Extracted from CodeGenerator to reduce file size.
 * Issue #857: Changed from memcpy to union for MISRA C:2012 Rule 21.15 compliance.
 *
 * Floats don't support direct bit access in C, so we use a union for type punning.
 * The pattern:
 *   1. Declare union variable if needed: union { float f; uint32_t u; } __bits_name;
 *   2. Copy float to union: __bits_name.f = floatVar;
 *   3. Modify bits via union member: __bits_name.u = ...
 *   4. Copy back: floatVar = __bits_name.f;
 *
 * This approach is MISRA-compliant because union type punning is well-defined in C99+.
 *
 * Migrated to use CodeGenState instead of constructor DI.
 */

import TIncludeHeader from "../../../../transpiler/types/TIncludeHeader";
import BitRangeHelper from "./BitRangeHelper";
import SaturatingCast from "./SaturatingCast";
import BitUtils from "../../../../utils/BitUtils";
import ComplianceAnnotations from "../../../2-Plan/ComplianceAnnotations";
import type TranspileState from "../../../TranspileState";
import type IFloatBitWrite from "../../../../transpiler/types/IFloatBitWrite";

/**
 * Callback types for code generation operations.
 */
interface IFloatBitCallbacks {
  /** Request an include header */
  requireInclude: (header: TIncludeHeader) => void;
}

/**
 * Generates float bit write operations using union-based type punning.
 *
 * For single bit: width is null, uses bitIndex only
 * For bit range: width is provided, uses bitIndex as start position
 */
class FloatBitHelper {
  /** The unsigned integer a float's bits are held in, at its width */
  static bitsTypeOf(floatType: string): string {
    return floatType === "f64" ? "uint64_t" : "uint32_t";
  }

  /**
   * The union a float's bits are read and written through, declared as
   * `name`, with the annotation that says why it is a union. The one
   * spelling the read and the write paths share (#1760 review: each built
   * it).
   */
  static unionDeclaration(floatType: string, name: string): string {
    const floatCType = SaturatingCast.floatCType(floatType);
    const bitsCType = FloatBitHelper.bitsTypeOf(floatType);
    return [
      ComplianceAnnotations.render(
        ComplianceAnnotations.floatBitsUnion(floatCType, bitsCType),
      ),
      `union { ${floatCType} f; ${bitsCType} u; } ${name};`,
    ].join("\n");
  }

  /**
   * Generate a float bit write using union-based type punning (ADR-007).
   *
   * A variable is written through its shadow union, `__bits_<name>`, which
   * the read path shares. Any other target -- an element, a field, a header
   * float reached through a chain -- has no name to key a shadow by, so it
   * is written through a union of its own, in a block (#1760 review: it was
   * written as a plain subscript store that C rejects).
   *
   * @param bitWrite - The float written, its type, and the bits written
   * @param callbacks - Code generation callbacks
   */
  static generateFloatBitWrite(
    bitWrite: IFloatBitWrite,
    callbacks: IFloatBitCallbacks,
    state: TranspileState,
  ): string {
    callbacks.requireInclude("float_static_assert"); // For size verification

    const target = bitWrite.target;
    const intType = FloatBitHelper.bitsTypeOf(bitWrite.floatType);
    // The integer member is written like any other integer (#1668): a bit
    // or a bit range of a uint32_t or a uint64_t
    const write = (bits: string): string =>
      bitWrite.width === null
        ? BitUtils.singleBitWrite(
            bits,
            bitWrite.bitIndex,
            bitWrite.value,
            intType,
          )
        : BitUtils.multiBitWrite(
            bits,
            bitWrite.bitIndex,
            bitWrite.width,
            bitWrite.value,
            intType,
          );

    if (!bitWrite.isVariable) {
      const body = [
        FloatBitHelper.unionDeclaration(bitWrite.floatType, "__bits"),
        `__bits.f = ${target};`,
        write("__bits.u"),
        `${target} = __bits.f;`,
      ].join("\n");
      const indented = body.replaceAll(/^/gm, "    ");
      return `{\n${indented}\n}`;
    }

    const shadowName = BitRangeHelper.getShadowVarName(target);
    // Check if shadow variable needs declaration
    const needsDeclaration = !state.floatBitShadows.has(shadowName);
    if (needsDeclaration) {
      state.floatBitShadows.add(shadowName);
    }
    // Check if shadow already has current value (skip redundant read)
    const shadowIsCurrent = state.floatShadowCurrent.has(shadowName);
    const decl = needsDeclaration
      ? `${FloatBitHelper.unionDeclaration(bitWrite.floatType, shadowName)}\n`
      : "";
    const readUnion = shadowIsCurrent ? "" : `${shadowName}.f = ${target};\n`;
    // Mark shadow as current after this write
    state.floatShadowCurrent.add(shadowName);
    const bits = write(`${shadowName}.u`);
    return `${decl}${readUnion}${bits}\n${target} = ${shadowName}.f;`;
  }
}

export default FloatBitHelper;
