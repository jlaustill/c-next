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
import ClampTypes from "../../../../2-Plan/ClampTypes";
import TYPE_WIDTH from "../../../../../types/TYPE_WIDTH";

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
 * The name a retry loop reads its value through. #1807: the value is
 * evaluated once, before the loop, so a failed attempt does not evaluate a
 * call in it again.
 */
const OPERAND = "__operand";

/**
 * The C type `__operand` holds the value in, so hoisting it narrows nothing
 * the inline form would not (#2120 review 2). A clamp helper's `b` is the
 * wider type (`ClampTypes`, #94: `cnx_clamp_add_u8(0, 256)` must give 255),
 * and a wider float value keeps its own precision, as `f32 += f64` does. A
 * wrap or bitwise integer value takes the variable's type: that narrowing is
 * modular, so the result is the same.
 */
function operandCType(
  typeInfo: TTypeInfo,
  clampOp: string | null,
  valueType: string | null,
): string {
  const cType = TYPE_MAP[typeInfo.baseType];
  if (clampOp) {
    return ClampTypes.resolve(typeInfo.baseType)?.widerType ?? cType;
  }
  const isWiderFloat =
    valueType !== null &&
    valueType.startsWith("f") &&
    (TYPE_WIDTH[valueType] ?? 0) > (TYPE_WIDTH[typeInfo.baseType] ?? 0);
  return isWiderFloat ? TYPE_MAP[valueType] : cType;
}

/**
 * Generate LDREX/STREX retry loop for atomic RMW.
 * Uses ARM exclusive access instructions for lock-free atomics.
 *
 * @param value - The value expression, evaluated once before the loop
 * @param innerOp - The new value, computed from `__old` and `__operand`
 * @returns Object with code and effects
 */
function generateLdrexStrexLoop(
  target: string,
  value: string,
  innerOp: string,
  typeInfo: TTypeInfo,
  innerEffects: readonly TGeneratorEffect[],
  operandType: string = TYPE_MAP[typeInfo.baseType],
): IGeneratorOutput {
  const effects: TGeneratorEffect[] = [...innerEffects];
  const ldrex = LDREX_MAP[typeInfo.baseType];
  const strex = STREX_MAP[typeInfo.baseType];
  const cType = TYPE_MAP[typeInfo.baseType];
  // #2208: CMSIS's intrinsics take an unsigned pointer; a signed value is
  // accessed through its unsigned type of the same width
  const exclusiveType = TYPE_MAP[typeInfo.baseType.replace(/^i/, "u")];
  const address =
    exclusiveType === cType
      ? `&${target}`
      : `(volatile ${exclusiveType} *)&${target}`;
  const loaded =
    exclusiveType === cType
      ? `${ldrex}(${address})`
      : `(${cType})${ldrex}(${address})`;
  const stored = exclusiveType === cType ? "__new" : `(${exclusiveType})__new`;
  // Rule 11.3 allows a cast to a pointer to a character type (uint8_t)
  const deviation =
    exclusiveType === cType || exclusiveType === "uint8_t"
      ? ""
      : ` MISRA C:2012 Rule 11.3 deviation (Issue #2208): the signed value is accessed through its same-width unsigned type, because CMSIS's ${ldrex}/${strex} take a pointer to ${exclusiveType}; C11 6.5p7 makes the access defined.`;

  // Uses do-while because we always need at least one attempt
  const code = `{
    /* ADR-049 / Issue #1807: atomic read-modify-write as an LDREX/STREX retry loop. The value is evaluated once, before the loop, so a failed store-exclusive does not evaluate it again.${deviation} */
    ${operandType} ${OPERAND} = ${value};
    do {
        ${cType} __old = ${loaded};
        ${cType} __new = ${innerOp};
        if (${strex}(${stored}, ${address}) == 0) {
            break;
        }
    } while (1);
}`;

  return { code, effects };
}

/**
 * #1789: a compare-exchange retry loop, for a target with neither LDREX/STREX
 * nor interrupt masking. The generic builtins take any type the variable can
 * have, floats included, and `__old` is reloaded by a failed exchange.
 *
 * @param value - The value expression, evaluated once before the loop
 * @param innerOp - The new value, computed from `__old` and `__operand`
 * @param libatomic - The type is wider than the target's word (ADR-049
 *   `word_size`), so GCC calls libatomic for it; the comment says so
 */
function generateCompareExchangeLoop(
  target: string,
  value: string,
  innerOp: string,
  typeInfo: TTypeInfo,
  innerEffects: readonly TGeneratorEffect[],
  operandType: string = TYPE_MAP[typeInfo.baseType],
  libatomic: boolean = false,
): IGeneratorOutput {
  const cType = TYPE_MAP[typeInfo.baseType];
  const wide = libatomic
    ? " The type is wider than the target's word, so the compiler calls libatomic's __atomic_*_N for it."
    : "";
  const code = `{
    /* ADR-049 / Issue #1789: atomic read-modify-write as a compare-exchange retry loop, for a target with neither LDREX/STREX nor an interrupt mask. The GNU __atomic builtins are a compiler extension (MISRA C:2012 Rule 1.2).${wide} The value is evaluated once, before the loop, so a failed exchange does not evaluate it again (Issue #1807). */
    ${operandType} ${OPERAND} = ${value};
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

/** The type info of an atomic value accessed as the C-Next integer `baseType` */
function accessedAs(baseType: string): TTypeInfo {
  return {
    baseType,
    bitWidth: TYPE_WIDTH[baseType] ?? 0,
    isArray: false,
    isConst: false,
  };
}

/**
 * ADR-049: Generate atomic Read-Modify-Write operation.
 * Written in the form 2.2 decided: LDREX/STREX, the masked region, or a
 * compare-exchange loop.
 *
 * @param target - The target variable expression
 * @param cOp - The C compound assignment operator (+=, -=, etc.)
 * @param value - The value expression
 * @param baseType - The C-Next integer 2.2 planned the atomic value as
 * @param clampOp - ADR-044 helper operation from
 *   `AssignmentClassifier.compoundClamp`, or null for plain arithmetic
 * @param form - The form 2.2 planned for this write
 * @param valueType - The value's C-Next type, or null when unknown
 * @returns Generated code and effects
 */
function generateAtomicRMW(
  target: string,
  cOp: string,
  value: string,
  baseType: string,
  clampOp: string | null,
  form: TAtomicForm,
  valueType: string | null = null,
): IGeneratorOutput {
  const typeInfo = accessedAs(baseType);
  const operandType = operandCType(typeInfo, clampOp, valueType);

  if (form === "interrupt-mask") {
    return generatePrimaskWrapper(target, cOp, value, typeInfo, clampOp);
  }

  // A retry loop reads the value once, through `__operand` (#1807)
  const innerResult = generateInnerAtomicOp(cOp, OPERAND, typeInfo, clampOp);

  if (form === "ldrex-strex") {
    invariant(
      LDREX_MAP[baseType] !== undefined,
      `2.2 plans an LDREX/STREX loop only for an exclusive-access type (got ${baseType})`,
    );
    return generateLdrexStrexLoop(
      target,
      value,
      innerResult.code,
      typeInfo,
      innerResult.effects,
      operandType,
    );
  }
  return generateCompareExchangeLoop(
    target,
    value,
    innerResult.code,
    typeInfo,
    innerResult.effects,
    operandType,
    form === "compare-exchange-libatomic",
  );
}

/**
 * ADR-049 (#2200): a bit, bit-range or bitmap-field write to an `atomic`
 * value, in the form 2.2 planned. `newValue` is the value stored, computed
 * from the value read: the target itself inside the masked region, `__old`
 * in a retry loop, which reads the written value once, through `__operand`.
 *
 * @param baseType - The C-Next integer the atomic value is accessed as
 * @param operandType - The C type `__operand` holds the written value in
 */
function generateAtomicStore(
  target: string,
  value: string,
  operandType: string,
  baseType: string,
  newValue: (read: string, value: string) => string,
  form: TAtomicForm,
): IGeneratorOutput {
  if (form === "interrupt-mask") {
    return InterruptMask.wrap(`${target} = ${newValue(target, value)};`);
  }
  const typeInfo = accessedAs(baseType);
  const inner = newValue("__old", OPERAND);
  if (form === "ldrex-strex") {
    return generateLdrexStrexLoop(
      target,
      value,
      inner,
      typeInfo,
      [],
      operandType,
    );
  }
  return generateCompareExchangeLoop(
    target,
    value,
    inner,
    typeInfo,
    [],
    operandType,
    form === "compare-exchange-libatomic",
  );
}

// Export all atomic generators
const atomicGenerators = {
  generateAtomicRMW,
  generateAtomicStore,
  generateInnerAtomicOp,
  generateLdrexStrexLoop,
  generateCompareExchangeLoop,
  generatePrimaskWrapper,
};

export default atomicGenerators;
