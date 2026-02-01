/**
 * StructGenerator - Struct Declaration Generation
 *
 * Generates C typedef struct declarations from C-Next struct syntax.
 *
 * Example:
 *   struct Point { i32 x; i32 y; }
 *   ->
 *   typedef struct {
 *       int32_t x;
 *       int32_t y;
 *   } Point;
 *
 * ADR-029: Structs with callback fields get an auto-generated init function.
 * ADR-036: Multi-dimensional array support in struct fields.
 */
import * as Parser from "../../../../logic/parser/grammar/CNextParser";
import IGeneratorInput from "../IGeneratorInput";
import IGeneratorState from "../IGeneratorState";
import IGeneratorOutput from "../IGeneratorOutput";
import IOrchestrator from "../IOrchestrator";
import TGeneratorFn from "../TGeneratorFn";
import TGeneratorEffect from "../TGeneratorEffect";

/**
 * Generate a C typedef struct from a C-Next struct declaration.
 *
 * Handles:
 * - Regular fields with primitive types
 * - Callback function pointer fields (ADR-029)
 * - Array fields with tracked dimensions (ADR-036)
 * - String array fields with capacity tracking
 */
const generateStruct: TGeneratorFn<Parser.StructDeclarationContext> = (
  node: Parser.StructDeclarationContext,
  input: IGeneratorInput,
  _state: IGeneratorState,
  orchestrator: IOrchestrator,
): IGeneratorOutput => {
  const effects: TGeneratorEffect[] = [];
  const name = node.IDENTIFIER().getText();
  const callbackFields: Array<{ fieldName: string; callbackType: string }> = [];

  const lines: string[] = [];
  // Issue #296: Use named struct for forward declaration compatibility
  lines.push(`typedef struct ${name} {`);

  for (const member of node.structMember()) {
    const fieldName = member.IDENTIFIER().getText();
    const typeName = orchestrator.getTypeName(member.type());
    // ADR-036: arrayDimension() now returns an array for multi-dimensional support
    const arrayDims = member.arrayDimension();
    const isArray = arrayDims.length > 0;

    // ADR-029: Check if this is a callback type field
    if (input.callbackTypes.has(typeName)) {
      const callbackInfo = input.callbackTypes.get(typeName)!;
      callbackFields.push({ fieldName, callbackType: typeName });

      // Track callback field for assignment validation via effect
      effects.push({
        type: "register-callback-field",
        key: `${name}.${fieldName}`,
        typeName,
      });

      if (isArray) {
        const dims = orchestrator.generateArrayDimensions(arrayDims);
        lines.push(`    ${callbackInfo.typedefName} ${fieldName}${dims};`);
      } else {
        lines.push(`    ${callbackInfo.typedefName} ${fieldName};`);
      }
    } else {
      // Regular field handling
      const type = orchestrator.generateType(member.type());

      // Check if we have tracked dimensions for this field (includes string capacity for string arrays)
      const trackedDimensions = input.symbols?.structFieldDimensions.get(name);
      const fieldDims = trackedDimensions?.get(fieldName);

      if (fieldDims && fieldDims.length > 0) {
        // Use tracked dimensions (includes string capacity for string arrays)
        const dimsStr = fieldDims.map((d) => `[${d}]`).join("");
        lines.push(`    ${type} ${fieldName}${dimsStr};`);
      } else if (isArray) {
        // Fall back to AST dimensions for non-string arrays
        const dims = orchestrator.generateArrayDimensions(arrayDims);
        lines.push(`    ${type} ${fieldName}${dims};`);
      } else {
        lines.push(`    ${type} ${fieldName};`);
      }
    }
  }

  lines.push(`} ${name};`, "");

  // ADR-029: Generate init function if struct has callback fields
  if (callbackFields.length > 0) {
    lines.push(generateStructInitFunction(name, callbackFields));
  }

  return {
    code: lines.join("\n"),
    effects,
  };
};

/**
 * ADR-029: Generate init function for structs with callback fields.
 * Sets all callback fields to their default functions.
 *
 * Example:
 *   struct Handler { onEvent callback; }
 *   ->
 *   Handler Handler_init(void) {
 *       return (Handler){
 *           .onEvent = callback
 *       };
 *   }
 */
function generateStructInitFunction(
  structName: string,
  callbackFields: Array<{ fieldName: string; callbackType: string }>,
): string {
  const lines: string[] = [];
  lines.push(
    `${structName} ${structName}_init(void) {`,
    `    return (${structName}){`,
  );

  for (let i = 0; i < callbackFields.length; i++) {
    const field = callbackFields[i];
    const comma = i < callbackFields.length - 1 ? "," : "";
    lines.push(`        .${field.fieldName} = ${field.callbackType}${comma}`);
  }

  lines.push(`    };`, `}`, "");

  return lines.join("\n");
}

export default generateStruct;
