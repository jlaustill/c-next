/**
 * Atomic Operation Generators (ADR-053 A3)
 *
 * Generates C code for atomic Read-Modify-Write operations (ADR-049):
 * - LDREX/STREX loops for platforms with exclusive access support
 * - PRIMASK-based wrappers for interrupt-safe operations
 *
 * These are helper functions called from assignment generation,
 * not top-level statement generators.
 */
import TTypeInfo from "../../types/TTypeInfo";
import IGeneratorOutput from "../IGeneratorOutput";
import TGeneratorEffect from "../TGeneratorEffect";
import ITargetCapabilities from "../../types/ITargetCapabilities";
import TYPE_WIDTH from "../../types/TYPE_WIDTH";

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
 * Map compound operators to simple operators
 */
const SIMPLE_OP_MAP: Record<string, string> = {
  "+=": "+",
  "-=": "-",
  "*=": "*",
  "/=": "/",
  "%=": "%",
  "&=": "&",
  "|=": "|",
  "^=": "^",
  "<<=": "<<",
  ">>=": ">>",
};

/**
 * Map compound operators to clamp helper operation names
 */
const CLAMP_OP_MAP: Record<string, string> = {
  "+=": "add",
  "-=": "sub",
  "*=": "mul",
};

/**
 * Check if clamp behavior applies and return the helper operation name.
 *
 * @param typeInfo - Type information for the target
 * @param cOp - The C compound assignment operator
 * @returns The helper operation name if clamp applies, null otherwise
 */
function getClampHelperOp(typeInfo: TTypeInfo, cOp: string): string | null {
  // Clamp behavior only applies to integers with clamp overflow behavior
  if (
    typeInfo.overflowBehavior === "clamp" &&
    TYPE_WIDTH[typeInfo.baseType] &&
    !typeInfo.baseType.startsWith("f") // Floats use native C arithmetic
  ) {
    const helperOp = CLAMP_OP_MAP[cOp];
    return helperOp || null;
  }
  return null;
}

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
): IGeneratorOutput {
  const effects: TGeneratorEffect[] = [];
  const simpleOp = SIMPLE_OP_MAP[cOp] || "+";

  // Handle clamp behavior for arithmetic operations (integers only)
  const helperOp = getClampHelperOp(typeInfo, cOp);
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

  // Mark that we need CMSIS headers
  effects.push({ type: "include", header: "cmsis" });

  // Generate LDREX/STREX retry loop
  // Uses do-while because we always need at least one attempt
  const code = `do {
    ${cType} __old = ${ldrex}(&${target});
    ${cType} __new = ${innerOp};
    if (${strex}(__new, &${target}) == 0) break;
} while (1);`;

  return { code, effects };
}

/**
 * Generate PRIMASK-based atomic wrapper.
 * Disables all interrupts during the RMW operation.
 *
 * @returns Object with code and effects (includes cmsis header, may include helper)
 */
function generatePrimaskWrapper(
  target: string,
  cOp: string,
  value: string,
  typeInfo: TTypeInfo,
): IGeneratorOutput {
  const effects: TGeneratorEffect[] = [];

  // Mark that we need CMSIS headers
  effects.push({ type: "include", header: "cmsis" });

  // Generate the actual assignment operation inside the critical section
  let assignment: string;

  // Handle clamp behavior (integers only)
  const helperOp = getClampHelperOp(typeInfo, cOp);
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

  // Generate PRIMASK save/restore wrapper
  const code = `{
    uint32_t __primask = __get_PRIMASK();
    __disable_irq();
    ${assignment}
    __set_PRIMASK(__primask);
}`;

  return { code, effects };
}

/**
 * ADR-049: Generate atomic Read-Modify-Write operation.
 * Uses LDREX/STREX on platforms that support it, otherwise PRIMASK.
 *
 * @param target - The target variable expression
 * @param cOp - The C compound assignment operator (+=, -=, etc.)
 * @param value - The value expression
 * @param typeInfo - Type information for the target
 * @param targetCapabilities - Platform capabilities
 * @returns Generated code and effects
 */
function generateAtomicRMW(
  target: string,
  cOp: string,
  value: string,
  typeInfo: TTypeInfo,
  targetCapabilities: ITargetCapabilities,
): IGeneratorOutput {
  const baseType = typeInfo.baseType;

  // Generate the inner operation (handles clamp/wrap)
  const innerResult = generateInnerAtomicOp(cOp, value, typeInfo);

  // Use LDREX/STREX if available for this type, otherwise PRIMASK fallback
  if (targetCapabilities.hasLdrexStrex && LDREX_MAP[baseType]) {
    return generateLdrexStrexLoop(
      target,
      innerResult.code,
      typeInfo,
      innerResult.effects,
    );
  } else {
    return generatePrimaskWrapper(target, cOp, value, typeInfo);
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
