/**
 * String assignment handlers (ADR-065).
 *
 * Handles assignments to string variables:
 * - STRING_SIMPLE: str <- "hello"
 * - STRING_THIS_MEMBER: this.name <- "value"
 * - STRING_GLOBAL: global.name <- "value"
 * - STRING_STRUCT_FIELD: person.name <- "Alice"
 * - STRING_ARRAY_ELEMENT: names[0] <- "first"
 * - STRING_STRUCT_ARRAY_ELEMENT: config.items[0] <- "value"
 */
import AssignmentKind from "../AssignmentKind";
import IAssignmentContext from "../IAssignmentContext";
import StringUtils from "../../../../../utils/StringUtils";
import TypeCheckUtils from "../../../../../utils/TypeCheckUtils";
import TAssignmentHandler from "./TAssignmentHandler";
import CodeGenState from "../../../../state/CodeGenState";
import invariant from "../../../../../utils/invariant";
import QualifiedNameGenerator from "../../utils/QualifiedNameGenerator";

/**
 * Validate compound operators are not used with strings.
 */
function validateNotCompound(ctx: IAssignmentContext): void {
  if (ctx.isCompound) {
    throw new Error(
      `Error: Compound operators not supported for string assignment: ${ctx.cnextOp}`,
    );
  }
}

/**
 * Common handler for simple string assignments (STRING_SIMPLE and STRING_GLOBAL).
 *
 * Gets capacity from typeRegistry and generates strncpy with null terminator.
 */
function handleSimpleStringAssignment(ctx: IAssignmentContext): string {
  validateNotCompound(ctx);

  const id = ctx.identifiers[0];
  const typeInfo = CodeGenState.getVariableTypeInfo(id);
  const capacity = typeInfo!.stringCapacity!;

  CodeGenState.requireInclude("string");

  const target = CodeGenState.requireGenerator().generateAssignmentTarget(
    ctx.targetCtx,
  );
  return StringUtils.copyWithNull(target, ctx.generatedValue, capacity);
}

/**
 * Get struct field type information.
 *
 * Shared helper for struct field string handlers.
 */
function getStructFieldType(structName: string, fieldName: string): string {
  // Issue #831: Use SymbolTable as single source of truth for struct fields
  const structTypeInfo = CodeGenState.getVariableTypeInfo(structName);
  // #1322: classified "dead -- delete" by #1321's audit, and it is indeed
  // unreachable: STRING_STRUCT_FIELD is produced only via
  // `AssignmentClassifier._resolveStructType`, which runs the identical
  // `getVariableTypeInfo` lookup and returns null when it misses. But deleting
  // it yields `TS18048: possibly 'undefined'` on the next line -- the guard is
  // doing type work as well as runtime work. Unreachable AND load-bearing is
  // not dead; it is an invariant, so it says so.
  invariant(
    structTypeInfo,
    "a classified struct assignment names a variable the symbol table knows",
  );

  const structType = structTypeInfo.baseType;
  const fieldType = CodeGenState.symbolTable?.getStructFieldType(
    structType,
    fieldName,
  );
  // Same shape: the classifier already required `getStructFieldType` truthy
  // and `TypeCheckUtils.isString` before producing this kind, so a miss here
  // is the transpiler contradicting itself, not the author's program.
  invariant(
    fieldType,
    "a classified string-field assignment names a field the struct declares",
  );

  return fieldType;
}

/**
 * Get struct type from a variable name.
 *
 * Shared helper for struct field handlers.
 */
function getStructType(structName: string): string {
  const structTypeInfo = CodeGenState.getVariableTypeInfo(structName);
  // #1322: classified "dead -- delete" by #1321's audit, and it is indeed
  // unreachable: STRING_STRUCT_FIELD is produced only via
  // `AssignmentClassifier._resolveStructType`, which runs the identical
  // `getVariableTypeInfo` lookup and returns null when it misses. But deleting
  // it yields `TS18048: possibly 'undefined'` on the next line -- the guard is
  // doing type work as well as runtime work. Unreachable AND load-bearing is
  // not dead; it is an invariant, so it says so.
  invariant(
    structTypeInfo,
    "a classified struct assignment names a variable the symbol table knows",
  );
  return structTypeInfo.baseType;
}

/**
 * Handle this.member string: this.name <- "value"
 */
function handleStringThisMember(ctx: IAssignmentContext): string {
  validateNotCompound(ctx);

  const memberName = ctx.identifiers[0];
  // The key must match `_classifyThisMemberString`
  // (AssignmentClassifier.ts:846), which hits the same map to decide whether to
  // route here at all -- so a mismatch makes the `!` below throw rather than
  // return a wrong answer. #1357 deleted a comment that said this alongside a
  // claim that had gone false ("leaf key, matching forMember"); the false half
  // deserved deleting and this half did not.
  const scopedName = QualifiedNameGenerator.forMember(
    CodeGenState.currentScopePath,
    memberName,
  );
  const typeInfo = CodeGenState.getVariableTypeInfo(scopedName);
  const capacity = typeInfo!.stringCapacity!;

  CodeGenState.requireInclude("string");

  const target = CodeGenState.requireGenerator().generateAssignmentTarget(
    ctx.targetCtx,
  );
  return StringUtils.copyWithNull(target, ctx.generatedValue, capacity);
}

/**
 * Handle struct.field string: person.name <- "Alice"
 */
function handleStringStructField(ctx: IAssignmentContext): string {
  validateNotCompound(ctx);

  const structName = ctx.identifiers[0];
  const fieldName = ctx.identifiers[1];

  const fieldType = getStructFieldType(structName, fieldName);
  const capacity = TypeCheckUtils.getStringCapacity(fieldType)!;

  CodeGenState.requireInclude("string");

  return StringUtils.copyToStructField(
    structName,
    fieldName,
    ctx.generatedValue,
    capacity,
  );
}

/**
 * Handle string array element: names[0] <- "first"
 */
function handleStringArrayElement(ctx: IAssignmentContext): string {
  validateNotCompound(ctx);

  const name = ctx.identifiers[0];
  const typeInfo = CodeGenState.getVariableTypeInfo(name);
  const capacity = typeInfo!.stringCapacity!;

  CodeGenState.requireInclude("string");

  const index = CodeGenState.requireGenerator().generateExpression(
    ctx.subscripts[0],
  );
  return StringUtils.copyToArrayElement(
    name,
    index,
    ctx.generatedValue,
    capacity,
  );
}

/**
 * Handle struct field string array element: config.items[0] <- "value"
 */
function handleStringStructArrayElement(ctx: IAssignmentContext): string {
  validateNotCompound(ctx);

  const structName = ctx.identifiers[0];
  const fieldName = ctx.identifiers[1];

  const structType = getStructType(structName);
  const dimensions =
    CodeGenState.symbols!.structFieldDimensions.get(structType)?.get(fieldName);

  // `_classifyStructArrayElementString` required `dimensions.length >= 1` from
  // the same map with the same keys before producing this kind.
  invariant(
    dimensions && dimensions.length > 0,
    "a classified struct-array string element has recorded dimensions",
  );

  // String arrays: dimensions are [array_size, string_capacity+1]
  // -1 because we added +1 for null terminator during symbol collection.
  //
  // The capacity is always numeric: it comes from the INTEGER_LITERAL in
  // `string<N>`, and the grammar restricts that token to [0-9]+. Since #1127
  // widened dimensions to (number | string)[] to carry enum-qualified counts,
  // assert that here rather than coercing -- a string in this slot would mean
  // the string-array shape changed, and silently producing NaN capacity would
  // corrupt every strncpy bound generated from it.
  const rawCapacity = dimensions.at(-1);
  invariant(
    typeof rawCapacity === "number",
    `a string<N> capacity is always numeric -- the grammar restricts that token to digits ('${structType}.${fieldName}' gave '${String(rawCapacity)}')`,
  );
  const capacity = rawCapacity - 1;

  CodeGenState.requireInclude("string");

  const index = CodeGenState.requireGenerator().generateExpression(
    ctx.subscripts[0],
  );
  return StringUtils.copyToStructFieldArrayElement(
    structName,
    fieldName,
    index,
    ctx.generatedValue,
    capacity,
  );
}

/**
 * All string handlers for registration.
 */
const stringHandlers: ReadonlyArray<[AssignmentKind, TAssignmentHandler]> = [
  [AssignmentKind.STRING_SIMPLE, handleSimpleStringAssignment],
  [AssignmentKind.STRING_THIS_MEMBER, handleStringThisMember],
  [AssignmentKind.STRING_GLOBAL, handleSimpleStringAssignment],
  [AssignmentKind.STRING_STRUCT_FIELD, handleStringStructField],
  [AssignmentKind.STRING_ARRAY_ELEMENT, handleStringArrayElement],
  [AssignmentKind.STRING_STRUCT_ARRAY_ELEMENT, handleStringStructArrayElement],
];

export default stringHandlers;
