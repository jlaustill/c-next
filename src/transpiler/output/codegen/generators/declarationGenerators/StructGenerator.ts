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
import ICodeGenSymbols from "../../../../types/ICodeGenSymbols";
import ArrayDimensionUtils from "./ArrayDimensionUtils";

/**
 * Generate a callback field declaration for a struct.
 */
function generateCallbackField(
  fieldName: string,
  callbackInfo: { typedefName: string },
  isArray: boolean,
  arrayDims: Parser.ArrayDimensionContext[],
  orchestrator: IOrchestrator,
): string {
  if (isArray) {
    const dims = orchestrator.generateArrayDimensions(arrayDims);
    return `    ${callbackInfo.typedefName} ${fieldName}${dims};`;
  }
  return `    ${callbackInfo.typedefName} ${fieldName};`;
}

/**
 * Generate a regular (non-callback) field declaration for a struct.
 */
function generateRegularField(
  fieldName: string,
  structName: string,
  member: Parser.StructMemberContext,
  isArray: boolean,
  arrayDims: Parser.ArrayDimensionContext[],
  input: IGeneratorInput,
  orchestrator: IOrchestrator,
): string {
  const type = orchestrator.generateType(member.type());

  // Check for arrayType syntax: u8[16] data -> member.type().arrayType()
  // Use optional chaining for mock compatibility in tests
  const arrayTypeCtx = member.type().arrayType?.() ?? null;
  const arrayTypeDimStr = ArrayDimensionUtils.generateArrayTypeDimension(
    arrayTypeCtx,
    orchestrator,
  );
  const hasArrayTypeSyntax = arrayTypeCtx !== null;

  // Check if we have tracked dimensions for this field (includes string capacity for string arrays)
  const fieldDims = getTrackedFieldDimensions(
    input.symbols,
    structName,
    fieldName,
  );

  if (fieldDims !== undefined) {
    // Use tracked dimensions (includes string capacity for string arrays)
    const dimsStr = fieldDims.map((d) => `[${d}]`).join("");
    return `    ${type} ${fieldName}${dimsStr};`;
  }

  if (hasArrayTypeSyntax || isArray) {
    // Combine arrayType dimension (if any) with arrayDimension dimensions
    const dims = orchestrator.generateArrayDimensions(arrayDims);
    return `    ${type} ${fieldName}${arrayTypeDimStr}${dims};`;
  }

  return `    ${type} ${fieldName};`;
}

/**
 * Get tracked field dimensions from symbols if available.
 */
function getTrackedFieldDimensions(
  symbols: ICodeGenSymbols | null,
  structName: string,
  fieldName: string,
): readonly number[] | undefined {
  if (!symbols) {
    return undefined;
  }
  const trackedDimensions = symbols.structFieldDimensions.get(structName);
  const fieldDims = trackedDimensions?.get(fieldName);
  return fieldDims && fieldDims.length > 0 ? fieldDims : undefined;
}

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

      lines.push(
        generateCallbackField(
          fieldName,
          callbackInfo,
          isArray,
          arrayDims,
          orchestrator,
        ),
      );
    } else {
      // Regular field handling
      lines.push(
        generateRegularField(
          fieldName,
          name,
          member,
          isArray,
          arrayDims,
          input,
          orchestrator,
        ),
      );
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
