/**
 * Literal Generator (ADR-053 A2)
 *
 * Generates C code for literal values:
 * - Boolean literals (true/false) → needs stdbool.h
 * - Float literals with C-Next suffixes (f32 → f, f64 → no suffix)
 * - Integer literals with C-Next suffixes (u64 → ULL, i64 → LL, strip 8/16/32)
 * - String and numeric literals pass through unchanged
 */
import { LiteralContext } from "../../../parser/grammar/CNextParser";
import IGeneratorOutput from "../IGeneratorOutput";
import TGeneratorEffect from "../TGeneratorEffect";
import IGeneratorInput from "../IGeneratorInput";
import IGeneratorState from "../IGeneratorState";
import IOrchestrator from "../IOrchestrator";

/**
 * Generate C code for a literal value.
 *
 * @param node - The LiteralContext AST node
 * @param _input - Read-only context (unused for literals)
 * @param _state - Current generation state (unused for literals)
 * @param _orchestrator - For delegating to other generators (unused for literals)
 * @returns Generated code and effects (stdbool include for bool literals)
 */
const generateLiteral = (
  node: LiteralContext,
  _input: IGeneratorInput,
  _state: IGeneratorState,
  _orchestrator: IOrchestrator,
): IGeneratorOutput => {
  const effects: TGeneratorEffect[] = [];
  let literalText = node.getText();

  // Track boolean literal usage to include stdbool.h
  if (literalText === "true" || literalText === "false") {
    effects.push({ type: "include", header: "stdbool" });
  }

  // ADR-024: Transform C-Next float suffixes to standard C syntax
  // 3.14f32 -> 3.14f (C float)
  // 3.14f64 -> 3.14 (C double, no suffix needed)
  if (/[fF]32$/.test(literalText)) {
    literalText = literalText.replace(/[fF]32$/, "f");
  } else if (/[fF]64$/.test(literalText)) {
    literalText = literalText.replace(/[fF]64$/, "");
  }

  // Issue #130: Transform C-Next integer suffixes to standard C syntax
  // u8/u16/u32 and i8/i16/i32 suffixes are stripped (C infers from context)
  // u64 -> ULL suffix for 64-bit unsigned
  // i64 -> LL suffix for 64-bit signed
  if (/[uU]64$/.test(literalText)) {
    literalText = literalText.replace(/[uU]64$/, "ULL");
  } else if (/[iI]64$/.test(literalText)) {
    literalText = literalText.replace(/[iI]64$/, "LL");
  } else if (/[uUiI](8|16|32)$/.test(literalText)) {
    // Strip 8/16/32-bit suffixes - C handles these without explicit suffix
    literalText = literalText.replace(/[uUiI](8|16|32)$/, "");
  }

  return { code: literalText, effects };
};

export default generateLiteral;
