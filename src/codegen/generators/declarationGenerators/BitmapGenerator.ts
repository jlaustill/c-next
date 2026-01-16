/**
 * BitmapGenerator - ADR-034 Bitmap Declaration Generation
 *
 * Generates C typedef declarations from C-Next bitmap syntax.
 * Bitmaps are fixed-width integers with named bit fields.
 *
 * Example:
 *   bitmap8 MotorFlags { Running, Direction, Mode[3], Reserved[2] }
 *   ->
 *   // Bitmap: MotorFlags
 *   // Fields:
 *   //   Running: bit 0 (1 bit)
 *   //   Direction: bit 1 (1 bit)
 *   //   Mode: bits 2-4 (3 bits)
 *   //   Reserved: bits 5-6 (2 bits)
 *   typedef uint8_t MotorFlags;
 */
import * as Parser from "../../../parser/grammar/CNextParser";
import IGeneratorInput from "../IGeneratorInput";
import IGeneratorState from "../IGeneratorState";
import IGeneratorOutput from "../IGeneratorOutput";
import IOrchestrator from "../IOrchestrator";
import TGeneratorFn from "../TGeneratorFn";
import TGeneratorEffect from "../TGeneratorEffect";

/**
 * Generate a C typedef from a C-Next bitmap declaration.
 *
 * ADR-034: Bitmaps provide type-safe bit field access.
 * The backing type (uint8_t, uint16_t, uint32_t) depends on the bitmap size.
 */
const generateBitmap: TGeneratorFn<Parser.BitmapDeclarationContext> = (
  node: Parser.BitmapDeclarationContext,
  input: IGeneratorInput,
  state: IGeneratorState,
  _orchestrator: IOrchestrator,
): IGeneratorOutput => {
  const effects: TGeneratorEffect[] = [];

  const name = node.IDENTIFIER().getText();

  // ADR-016: Apply scope prefix if inside a scope
  const prefix = state.currentScope ? `${state.currentScope}_` : "";
  const fullName = `${prefix}${name}`;

  // Look up backing type from symbols (collected by SymbolCollector)
  const backingType = input.symbols?.bitmapBackingType.get(fullName);
  if (!backingType) {
    throw new Error(`Error: Bitmap ${fullName} not found in registry`);
  }

  // Bitmap requires stdint.h for uint8_t, uint16_t, etc.
  effects.push({ type: "include", header: "stdint" });

  const lines: string[] = [];

  // Generate comment with field layout
  lines.push(`/* Bitmap: ${fullName} */`);

  const fields = input.symbols?.bitmapFields.get(fullName);
  if (fields) {
    lines.push("/* Fields:");
    for (const [fieldName, info] of fields.entries()) {
      const endBit = info.offset + info.width - 1;
      const bitRange =
        info.width === 1
          ? `bit ${info.offset}`
          : `bits ${info.offset}-${endBit}`;
      lines.push(
        ` *   ${fieldName}: ${bitRange} (${info.width} bit${info.width > 1 ? "s" : ""})`,
      );
    }
    lines.push(" */");
  }

  lines.push(`typedef ${backingType} ${fullName};`);
  lines.push("");

  return {
    code: lines.join("\n"),
    effects,
  };
};

export default generateBitmap;
