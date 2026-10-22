/**
 * Literal Generator
 *
 * Generates C code for literal values:
 * - Boolean literals (true/false) → needs stdbool.h
 * - Float literals with cnx suffixes (f32 → f, f64 → no suffix)
 * - Integer literals with cnx suffixes (u64 → ULL, i64 → LL, strip 8/16/32)
 * - MISRA Rule 7.2: Unsigned suffix for unsigned integer types
 * - String and numeric literals pass through unchanged
 */
import type TPlannedNarrowing from "../../../../2-Plan/types/TPlannedNarrowing";
import IGeneratorOutput from "../IGeneratorOutput";
import TGeneratorEffect from "../TGeneratorEffect";
import IGeneratorState from "../IGeneratorState";
import NarrowingCastHelper from "../../../../2-Plan/NarrowingCastHelper";
import LiteralUtils from "../../../../../utils/LiteralUtils";
import type TranspileState from "../../../../TranspileState";

/**
 * Unsigned type patterns for MISRA Rule 7.2 compliance.
 * Includes both cnx types (u8, u16, u32, u64) and C types (uint8_t, etc.)
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

/** The words C's own integer type spellings are made of */
const C_INTEGER_WORDS = new Set(["char", "short", "int", "long"]);

/**
 * C's own unsigned integer spellings, as a header's typedef names them, in any
 * word order: GCC itself writes `long unsigned int` (`__SIZE_TYPE__`, newlib's
 * `__UINT32_TYPE__`) where a header author writes `unsigned long`
 */
function isCUnsignedSpelling(name: string): boolean {
  const words = name.split(/\s+/);
  return (
    words.filter((word) => word === "unsigned").length === 1 &&
    words.every((word) => word === "unsigned" || C_INTEGER_WORDS.has(word))
  );
}

/**
 * The unsigned suffix a type gives an integer literal, if any (MISRA 7.2).
 *
 * Every name on the typedef chain is asked, not only its end: once a header
 * declares `size_t` or `uint32_t` (#1755), the chain ends in the compiler's
 * own spelling (`unsigned long`, `__uint32_t`), and the type is unsigned all
 * the same.
 */
function unsignedSuffixOf(
  typeName: string,
  state: TranspileState,
): "U" | "ULL" | null {
  const seen = new Set<string>();
  let name: string | undefined = typeName.trim();
  while (name !== undefined && !seen.has(name)) {
    seen.add(name);
    if (UNSIGNED_64_TYPES.has(name)) return "ULL";
    if (UNSIGNED_TYPES.has(name) || isCUnsignedSpelling(name)) {
      return "U";
    }
    name = state.getTypedefType(name)?.trim();
  }
  return null;
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
  // Exclude floats -- the one decision of what a floating literal is (#1668)
  if (LiteralUtils.floatLiteralWidth(text) !== null) {
    return false;
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
 * Takes the literal's TEXT, not its parse node (#1445). Every branch below
 * reads the text and `state.expectedType` and nothing else -- the node was
 * only ever `node.getText()` -- so naming `LiteralContext` here bought a
 * dependency on the grammar for a string. This is the first render-layer
 * module to stop holding a parse context, and the shape the rest follow: the
 * IR node for a literal IS its text, so the caller extracts it and this
 * function can be reached, and tested, without a parser.
 *
 * @param text - The literal's source text, e.g. `3.14f32`, `true`, `'A'`
 * @param state - Current generation state (contains expectedType)
 * @returns Generated code and effects (the `bool` type for bool literals)
 */
const generateLiteral = (
  text: string,
  state: IGeneratorState,
  transpileState: TranspileState,
  narrowing: TPlannedNarrowing | null,
): IGeneratorOutput => {
  const effects: TGeneratorEffect[] = [];
  let literalText = text;

  if (literalText === "true" || literalText === "false") {
    return { code: literalText, effects };
  }

  // MISRA 10.3: Character literals have type int in C
  // When assigning to narrower types (u8, i8, u16, i16), add explicit cast
  if (literalText.startsWith("'")) {
    return {
      code: NarrowingCastHelper.apply(literalText, narrowing, transpileState),
      effects,
    };
  }

  // ADR-024: Transform cnx float suffixes to standard C syntax
  // 3.14f32 -> 3.14f (C float)
  // 3.14f64 -> 3.14 (C double, no suffix needed)
  // #1668: asked of the whole literal, not of its last three characters --
  // the hex integer 0xFF32 ends in `F32` too, and was emitted as 0xFf.
  const floatParts = LiteralUtils.floatLiteralParts(literalText);
  if (floatParts !== null) {
    const suffix = floatParts.width === 32 ? "f" : "";
    return { code: floatParts.unsuffixed + suffix, effects };
  }

  // Issue #130: Transform cnx integer suffixes to standard C syntax
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
    literalText += unsignedSuffixOf(expectedType, transpileState) ?? "";
  }

  return { code: literalText, effects };
};

export default generateLiteral;
