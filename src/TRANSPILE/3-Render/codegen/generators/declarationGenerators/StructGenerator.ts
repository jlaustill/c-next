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
 *
 * #1445 box 3: takes `IPlannedStruct`, not the node. What is left here is what
 * this generator should decide -- which fields are callbacks, which need an
 * explicit zero, and whether tracked dimensions override the written ones --
 * none of which is a question about the tree.
 */
import IGeneratorInput from "../IGeneratorInput";
import IGeneratorState from "../IGeneratorState";
import IGeneratorOutput from "../IGeneratorOutput";
import IOrchestrator from "../IOrchestrator";
import TGeneratorFn from "../TGeneratorFn";
import TGeneratorEffect from "../TGeneratorEffect";
import ICodeGenSymbols from "../../../../../transpiler/types/ICodeGenSymbols";
import IStructFieldInit from "../../types/IStructFieldInit";
import StructInitFunction from "../../helpers/StructInitFunction";
import type IPlannedStruct from "../../types/IPlannedStruct";
import type IPlannedStructField from "../../types/IPlannedStructField";

/**
 * Generate a callback field declaration for a struct.
 */
function generateCallbackField(
  field: IPlannedStructField,
  callbackInfo: { typedefName: string },
): string {
  if (field.hasNameDimensions) {
    return `    ${callbackInfo.typedefName} ${field.name}${field.renderNameDimensions()};`;
  }
  return `    ${callbackInfo.typedefName} ${field.name};`;
}

/**
 * Generate a regular (non-callback) field declaration for a struct.
 */
function generateRegularField(
  field: IPlannedStructField,
  structName: string,
  input: IGeneratorInput,
): string {
  const type = field.renderCType();

  // Check if we have tracked dimensions for this field (includes string capacity for string arrays)
  const fieldDims = getTrackedFieldDimensions(
    input.symbols,
    structName,
    field.name,
  );

  if (fieldDims !== undefined) {
    // Use tracked dimensions (includes string capacity for string arrays).
    // Neither dimension render runs on this branch, which is why both arrive
    // as thunks: rendering them here would register effects for dimensions
    // this field does not emit.
    const dimsStr = fieldDims.map((d) => `[${d}]`).join("");
    return `    ${type} ${field.name}${dimsStr};`;
  }

  if (field.hasTypeDimensions || field.hasNameDimensions) {
    // Combine arrayType dimension (if any) with arrayDimension dimensions
    return `    ${type} ${field.name}${field.renderTypeDimensions()}${field.renderNameDimensions()};`;
  }

  return `    ${type} ${field.name};`;
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
const generateStruct: TGeneratorFn<IPlannedStruct> = (
  planned: IPlannedStruct,
  input: IGeneratorInput,
  state: IGeneratorState,
  orchestrator: IOrchestrator,
): IGeneratorOutput => {
  const effects: TGeneratorEffect[] = [];
  const { name } = planned;
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

  for (const field of planned.fields) {
    const fieldName = field.name;
    const typeName = field.typeName;

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

      lines.push(generateCallbackField(field, callbackInfo));
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
          initializer: field.renderZeroInitializer(),
        });
      }

      // Regular field handling
      lines.push(generateRegularField(field, name, input));
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
