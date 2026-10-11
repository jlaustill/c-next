/**
 * Atomic Operation Generators
 *
 * Generates C code for atomic Read-Modify-Write operations (ADR-049):
 * - LDREX/STREX loops for platforms with exclusive access support
 * - PRIMASK-based wrappers for interrupt-safe operations
 *
 * These are helper functions called from assignment generation,
 * not top-level statement generators.
 */
import TTypeInfo from "../../../../../types/TTypeInfo";
import IGeneratorOutput from "../IGeneratorOutput";
import TGeneratorEffect from "../TGeneratorEffect";
import type ITargetDescription from "../../../../../types/ITargetDescription";
import COMPOUND_TO_BINARY from "../../types/COMPOUND_TO_BINARY";
import InterruptMask from "../../helpers/InterruptMask";

/**
 * Maps C-Next types to C types (for atomic operations)
 */
const TYPE_MAP: Record<string, string> = {
  u8: "uint8_t",
  u16: "uint16_t",
  u32: "uint32_t",
  u64: "uint64_t",
  i8: "int8_t",
  i16: "int16_t",
  i32: "int32_t",
  i64: "int64_t",
};

/**
 * ADR-049: LDREX intrinsic map for atomic operations
 * Maps C-Next types to ARM LDREX (Load-Exclusive) instructions
 */
const LDREX_MAP: Record<string, string> = {
  u8: "__LDREXB",
  i8: "__LDREXB",
  u16: "__LDREXH",
  i16: "__LDREXH",
  u32: "__LDREXW",
  i32: "__LDREXW",
};

/**
 * ADR-049: STREX intrinsic map for atomic operations
 * Maps C-Next types to ARM STREX (Store-Exclusive) instructions
 */
const STREX_MAP: Record<string, string> = {
  u8: "__STREXB",
  i8: "__STREXB",
  u16: "__STREXH",
  i16: "__STREXH",
  u32: "__STREXW",
  i32: "__STREXW",
};

/**
 * Generate the inner operation for atomic RMW.
 * Handles clamp/wrap behavior for arithmetic operations.
 *
 * @returns Object with code and effects (may include helper effects for clamp)
 */
function generateInnerAtomicOp(
  cOp: string,
  value: string,
  typeInfo: TTypeInfo,
  helperOp: string | null,
): IGeneratorOutput {
  const effects: TGeneratorEffect[] = [];
  const simpleOp = COMPOUND_TO_BINARY[cOp] || "+";

  // Saturate when the classifier chose a clamp helper
  if (helperOp) {
    effects.push({
      type: "helper",
      operation: helperOp,
      cnxType: typeInfo.baseType,
    });
    return {
      code: `cnx_clamp_${helperOp}_${typeInfo.baseType}(__old, ${value})`,
      effects,
    };
  }

  // For wrap behavior, floats, or non-clamp ops, use natural arithmetic
  return { code: `__old ${simpleOp} ${value}`, effects };
}

/**
 * Generate LDREX/STREX retry loop for atomic RMW.
 * Uses ARM exclusive access instructions for lock-free atomics.
 *
 * @returns Object with code and effects (includes cmsis header)
 */
function generateLdrexStrexLoop(
  target: string,
  innerOp: string,
  typeInfo: TTypeInfo,
  innerEffects: readonly TGeneratorEffect[],
): IGeneratorOutput {
  const effects: TGeneratorEffect[] = [...innerEffects];
  const ldrex = LDREX_MAP[typeInfo.baseType];
  const strex = STREX_MAP[typeInfo.baseType];
  const cType = TYPE_MAP[typeInfo.baseType];

  // Mark that we need CMSIS headers, and record what this branch costs.
  // Issue #1143: recorded here, in the branch that emits __LDREX*/__STREX*,
  // so the requirement cannot be attributed to a file that took the other
  // branch below.
  effects.push(
    { type: "include", header: "cmsis" },
    { type: "requires", key: "atomic-ldrex-cmsis", line: null },
    { type: "c-type", cType },
  );

  // Generate LDREX/STREX retry loop
  // Uses do-while because we always need at least one attempt
  const code = `do {
    ${cType} __old = ${ldrex}(&${target});
    ${cType} __new = ${innerOp};
    if (${strex}(__new, &${target}) == 0) {
        break;
    }
} while (1);`;

  return { code, effects };
}

/**
 * Generate an interrupt-masked atomic read-modify-write: the ADR-050 masked
 * region a `critical` block takes, through the same `__cnx_` IRQ wrappers
 * (#1146: this emitted raw CMSIS with no platform guard, so AVR got CMSIS
 * calls where `critical` got SREG).
 *
 * @returns Object with code and effects (the IRQ wrappers, may include helper)
 */
function generatePrimaskWrapper(
  target: string,
  cOp: string,
  value: string,
  typeInfo: TTypeInfo,
  helperOp: string | null,
): IGeneratorOutput {
  const effects: TGeneratorEffect[] = [];

  // Generate the actual assignment operation inside the masked region
  let assignment: string;

  // Saturate when the classifier chose a clamp helper
  if (helperOp) {
    effects.push({
      type: "helper",
      operation: helperOp,
      cnxType: typeInfo.baseType,
    });
    assignment = `${target} = cnx_clamp_${helperOp}_${typeInfo.baseType}(${target}, ${value});`;
  } else {
    assignment = `${target} ${cOp} ${value};`;
  }

  const masked = InterruptMask.wrap(assignment, undefined);
  return { code: masked.code, effects: [...effects, ...masked.effects] };
}

/**
 * ADR-049: Generate atomic Read-Modify-Write operation.
 * Uses LDREX/STREX on platforms that support it, otherwise PRIMASK.
 *
 * @param target - The target variable expression
 * @param cOp - The C compound assignment operator (+=, -=, etc.)
 * @param value - The value expression
 * @param typeInfo - Type information for the target
 * @param clampOp - ADR-044 helper operation from
 *   `AssignmentClassifier.compoundClamp`, or null for plain arithmetic
 * @param targetDescription - The target this file is generated for
 * @returns Generated code and effects
 */
function generateAtomicRMW(
  target: string,
  cOp: string,
  value: string,
  typeInfo: TTypeInfo,
  clampOp: string | null,
  targetDescription: ITargetDescription,
): IGeneratorOutput {
  const baseType = typeInfo.baseType;

  // Generate the inner operation (handles clamp/wrap)
  const innerResult = generateInnerAtomicOp(cOp, value, typeInfo, clampOp);

  // Use LDREX/STREX if available for this type, otherwise PRIMASK fallback
  if (targetDescription.ldrex_strex && LDREX_MAP[baseType]) {
    return generateLdrexStrexLoop(
      target,
      innerResult.code,
      typeInfo,
      innerResult.effects,
    );
  } else {
    return generatePrimaskWrapper(target, cOp, value, typeInfo, clampOp);
  }
}

// Export all atomic generators
const atomicGenerators = {
  generateAtomicRMW,
  generateInnerAtomicOp,
  generateLdrexStrexLoop,
  generatePrimaskWrapper,
};

export default atomicGenerators;
