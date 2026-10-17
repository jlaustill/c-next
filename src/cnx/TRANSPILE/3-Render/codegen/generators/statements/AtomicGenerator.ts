/**
 * Atomic Operation Generators
 *
 * Generates C code for atomic Read-Modify-Write operations (ADR-049):
 * - LDREX/STREX loops for platforms with exclusive access support
 * - PRIMASK-based wrappers for interrupt-safe operations
 * - GNU `__atomic` compare-exchange loops where neither exists (#1789)
 *
 * These are helper functions called from assignment generation,
 * not top-level statement generators.
 */
import TTypeInfo from "../../../../../types/TTypeInfo";
import IGeneratorOutput from "../IGeneratorOutput";
import TGeneratorEffect from "../TGeneratorEffect";
import type TAtomicForm from "../../../../types/TAtomicForm";
import LDREX_MAP from "../../../../2-Plan/types/LDREX_MAP";
import TYPE_MAP from "../../../../2-Plan/types/TYPE_MAP";
import invariant from "../../../../../utils/invariant";
import COMPOUND_TO_BINARY from "../../../../2-Plan/types/COMPOUND_TO_BINARY";
import InterruptMask from "../../helpers/InterruptMask";

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
 * @returns Object with code and effects
 */
function generateInnerAtomicOp(
  cOp: string,
  value: string,
  typeInfo: TTypeInfo,
  helperOp: string | null,
): IGeneratorOutput {
  const effects: TGeneratorEffect[] = [];
  const simpleOp = COMPOUND_TO_BINARY[cOp];
  invariant(
    simpleOp !== undefined,
    `an atomic read-modify-write is a compound assignment (got '${cOp}')`,
  );

  // Saturate when the classifier chose a clamp helper
  if (helperOp) {
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
 * @returns Object with code and effects
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
 * #1789: a compare-exchange retry loop, for a target with neither LDREX/STREX
 * nor interrupt masking. The generic builtins take any type the variable can
 * have, floats included, and `__old` is reloaded by a failed exchange.
 */
function generateCompareExchangeLoop(
  target: string,
  innerOp: string,
  typeInfo: TTypeInfo,
  innerEffects: readonly TGeneratorEffect[],
): IGeneratorOutput {
  const cType = TYPE_MAP[typeInfo.baseType];
  const code = `{
    ${cType} __old;
    ${cType} __new;
    __atomic_load(&${target}, &__old, __ATOMIC_RELAXED);
    do {
        __new = ${innerOp};
    } while (!__atomic_compare_exchange(&${target}, &__old, &__new, 0, __ATOMIC_SEQ_CST, __ATOMIC_RELAXED));
}`;
  return { code, effects: [...innerEffects] };
}

/**
 * Generate an interrupt-masked atomic read-modify-write: the ADR-050 masked
 * region a `critical` block takes, through the same `__cnx_` IRQ wrappers
 * (#1146: this emitted raw CMSIS with no platform guard, so AVR got CMSIS
 * calls where `critical` got SREG).
 *
 * @returns Object with code and effects
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
    assignment = `${target} = cnx_clamp_${helperOp}_${typeInfo.baseType}(${target}, ${value});`;
  } else {
    assignment = `${target} ${cOp} ${value};`;
  }

  const masked = InterruptMask.wrap(assignment);
  return { code: masked.code, effects: [...effects, ...masked.effects] };
}

/**
 * ADR-049: Generate atomic Read-Modify-Write operation.
 * Written in the form 2.2 decided: LDREX/STREX, the masked region, or a
 * compare-exchange loop.
 *
 * @param target - The target variable expression
 * @param cOp - The C compound assignment operator (+=, -=, etc.)
 * @param value - The value expression
 * @param typeInfo - Type information for the target
 * @param clampOp - ADR-044 helper operation from
 *   `AssignmentClassifier.compoundClamp`, or null for plain arithmetic
 * @param form - The form 2.2 planned for this write
 * @returns Generated code and effects
 */
function generateAtomicRMW(
  target: string,
  cOp: string,
  value: string,
  typeInfo: TTypeInfo,
  clampOp: string | null,
  form: TAtomicForm,
): IGeneratorOutput {
  const baseType = typeInfo.baseType;

  // Generate the inner operation (handles clamp/wrap)
  const innerResult = generateInnerAtomicOp(cOp, value, typeInfo, clampOp);

  if (form === "ldrex-strex") {
    invariant(
      LDREX_MAP[baseType] !== undefined,
      `2.2 plans an LDREX/STREX loop only for an exclusive-access type (got ${baseType})`,
    );
    return generateLdrexStrexLoop(
      target,
      innerResult.code,
      typeInfo,
      innerResult.effects,
    );
  } else if (form === "compare-exchange") {
    return generateCompareExchangeLoop(
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
  generateCompareExchangeLoop,
  generatePrimaskWrapper,
};

export default atomicGenerators;
