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
import * as Parser from "../../../../../PARSE/2-Parse/grammar/CNextParser";
import IGeneratorInput from "../IGeneratorInput";
import IGeneratorState from "../IGeneratorState";
import IGeneratorOutput from "../IGeneratorOutput";
import IOrchestrator from "../IOrchestrator";
import TGeneratorFn from "../TGeneratorFn";
import TGeneratorEffect from "../TGeneratorEffect";
import ICodeGenSymbols from "../../../../../transpiler/types/ICodeGenSymbols";
import ArrayDimensionUtils from "./ArrayDimensionUtils";
import IStructFieldInit from "../../types/IStructFieldInit";
import StructInitFunction from "../../helpers/StructInitFunction";

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
): readonly (number | string)[] | undefined {
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
  state: IGeneratorState,
  orchestrator: IOrchestrator,
): IGeneratorOutput => {
  const effects: TGeneratorEffect[] = [];
  const name = node.IDENTIFIER().getText();
  // #1566: the fields the ADR-029 init function assigns, in declaration order.
  // Only the ones whose correct value is NOT zero -- everything else is covered
  // by zeroing the aggregate once, so no array-ness is re-derived here.
  //
  // #1568: `hasCallbackField` is set in the loop below rather than by a second
  // pass applying the same predicate. Two copies agree only while their text is
  // identical: if callback detection gained a case and one copy learned it, the
  // loop would collect fields while the flag reported no init function, and the
  // header would declare nothing for a struct whose fields were still assigned.
  const assignments: IStructFieldInit[] = [];
  let hasCallbackField = false;

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
      hasCallbackField = true;
      // ADR-029 "Never Null": a callback field initializes to the function its
      // type was defined from. #1565: for an ARRAY of a callback type this
      // assigns element 0 only and leaves the rest null, which that guarantee
      // forbids -- filed, not fixed here, and unreachable from the corpus.
      assignments.push({ fieldName, initializer: typeName });

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
      // An enum is the one non-callback field whose zero is not the aggregate's
      // zero: `enum Mode { IDLE <- 5, RUNNING }` has no enumerator 0, so zeroing
      // leaves the field holding a value outside its own type. Assigning a
      // literal 0 is not the alternative -- that is `invalid conversion from
      // 'int' to 'Mode'` in C++ -- so the value comes from the per-type zero,
      // which resolves an enum to a real enumerator. Every other field is
      // correctly covered by the aggregate zero and gets no assignment.
      if (input.symbols?.knownEnums.has(typeName) === true) {
        assignments.push({
          fieldName,
          initializer: orchestrator.getZeroInitializer(member.type(), false),
        });
      }

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

  // Issues #369/#1164: when the .c includes its own header, the header owns the
  // *type*. The ADR-029 init function is a definition, not a type — it has
  // external linkage and no other home, so it is still emitted here. Suppressing
  // the whole generator (rather than just the typedef) silently dropped it.
  const typeDefinition = state.headerOwnsTypeDefinitions ? [] : lines;

  // #1205: the init function is emitted here and declared in the header. The
  // header is told which structs got one rather than working it out again --
  // see StructInitFunction for why re-deriving it there is wrong.
  const initFunction: string[] = [];
  if (hasCallbackField) {
    initFunction.push(
      StructInitFunction.definition(
        name,
        orchestrator.getAggregateZeroInitBrace(),
        assignments,
      ),
    );
    effects.push({ type: "register-struct-init", structName: name });
  }

  return {
    code: [...typeDefinition, ...initFunction].join("\n"),
    effects,
  };
};

export default generateStruct;
