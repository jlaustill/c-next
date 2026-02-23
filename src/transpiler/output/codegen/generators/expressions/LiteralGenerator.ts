/**
 * Literal Generator (ADR-053 A2)
 *
 * Generates C code for literal values:
 * - Boolean literals (true/false) → needs stdbool.h
 * - Float literals with C-Next suffixes (f32 → f, f64 → no suffix)
 * - Integer literals with C-Next suffixes (u64 → ULL, i64 → LL, strip 8/16/32)
 * - MISRA Rule 7.2: Unsigned suffix for unsigned integer types
 * - String and numeric literals pass through unchanged
 */
import { LiteralContext } from "../../../../logic/parser/grammar/CNextParser";
import IGeneratorOutput from "../IGeneratorOutput";
import TGeneratorEffect from "../TGeneratorEffect";
import IGeneratorInput from "../IGeneratorInput";
import IGeneratorState from "../IGeneratorState";
import IOrchestrator from "../IOrchestrator";
import CodeGenState from "../../../../state/CodeGenState";

/**
 * Unsigned type patterns for MISRA Rule 7.2 compliance.
 * Includes both C-Next types (u8, u16, u32, u64) and C types (uint8_t, etc.)
 */
const UNSIGNED_64_TYPES = new Set(["u64", "uint64_t"]);
const UNSIGNED_TYPES = new Set([
  "u8",
  "u16",
  "u32",
  "uint8_t",
  "uint16_t",
  "uint32_t",
  "size_t", // Array indices (MISRA 7.2)
]);

/**
 * Resolve typedef aliases to their underlying type.
 * For C typedef'd types (e.g., "byte_t" -> "uint8_t"), look up the symbol table.
 */
function resolveTypedef(typeName: string): string {
  const underlyingType = CodeGenState.getTypedefType(typeName);
  return underlyingType ?? typeName;
}

/**
 * Check if a literal is a numeric integer (decimal, hex, octal, or binary).
 * Excludes strings, floats, and booleans.
 */
function isNumericIntegerLiteral(text: string): boolean {
  // Exclude strings (quoted)
  if (text.startsWith('"') || text.startsWith("'")) {
    return false;
  }
  // Exclude booleans
  if (text === "true" || text === "false") {
    return false;
  }
  // Exclude floats (contain decimal point or exponent without 0x prefix)
  if (!text.startsWith("0x") && !text.startsWith("0X")) {
    if (text.includes(".") || /[eE][+-]?\d/.test(text)) {
      return false;
    }
  }
  // Must start with digit or be hex/binary/octal
  return /^\d/.test(text) || /^0[xXbBoO]/.test(text);
}

/**
 * Check if a literal already has a C unsigned suffix (U, UL, ULL).
 */
function hasUnsignedSuffix(text: string): boolean {
  return /[uU]([lL]{0,2})$/.test(text);
}

/**
 * Generate C code for a literal value.
 *
 * @param node - The LiteralContext AST node
 * @param _input - Read-only context (unused for literals)
 * @param state - Current generation state (contains expectedType)
 * @param _orchestrator - For delegating to other generators (unused for literals)
 * @returns Generated code and effects (stdbool include for bool literals)
 */
const generateLiteral = (
  node: LiteralContext,
  _input: IGeneratorInput,
  state: IGeneratorState,
  _orchestrator: IOrchestrator,
): IGeneratorOutput => {
  const effects: TGeneratorEffect[] = [];
  let literalText = node.getText();

  // Track boolean literal usage to include stdbool.h
  if (literalText === "true" || literalText === "false") {
    effects.push({ type: "include", header: "stdbool" });
    return { code: literalText, effects };
  }

  // ADR-024: Transform C-Next float suffixes to standard C syntax
  // 3.14f32 -> 3.14f (C float)
  // 3.14f64 -> 3.14 (C double, no suffix needed)
  if (/[fF]32$/.test(literalText)) {
    literalText = literalText.replace(/[fF]32$/, "f");
    return { code: literalText, effects };
  }
  if (/[fF]64$/.test(literalText)) {
    literalText = literalText.replace(/[fF]64$/, "");
    return { code: literalText, effects };
  }

  // Issue #130: Transform C-Next integer suffixes to standard C syntax
  // u8/u16/u32 and i8/i16/i32 suffixes are stripped (C infers from context)
  // u64 -> ULL suffix for 64-bit unsigned
  // i64 -> LL suffix for 64-bit signed
  if (/[uU]64$/.test(literalText)) {
    literalText = literalText.replace(/[uU]64$/, "ULL");
    return { code: literalText, effects };
  }
  if (/[iI]64$/.test(literalText)) {
    literalText = literalText.replace(/[iI]64$/, "LL");
    return { code: literalText, effects };
  }
  if (/[uUiI](8|16|32)$/.test(literalText)) {
    // Strip 8/16/32-bit suffixes - will add U below if needed for MISRA
    literalText = literalText.replace(/[uUiI](8|16|32)$/, "");
  }

  // MISRA Rule 7.2: Add unsigned suffix based on expectedType
  // Only applies to numeric integer literals without existing unsigned suffix
  const expectedType = state?.expectedType;
  if (
    expectedType &&
    isNumericIntegerLiteral(literalText) &&
    !hasUnsignedSuffix(literalText)
  ) {
    // Resolve typedef aliases (e.g., "byte_t" -> "uint8_t")
    const resolvedType = resolveTypedef(expectedType);
    if (UNSIGNED_64_TYPES.has(resolvedType)) {
      literalText = literalText + "ULL";
    } else if (UNSIGNED_TYPES.has(resolvedType)) {
      literalText = literalText + "U";
    }
  }

  return { code: literalText, effects };
};

export default generateLiteral;
