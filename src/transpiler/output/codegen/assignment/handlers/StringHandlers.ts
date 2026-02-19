/**
 * String assignment handlers (ADR-109).
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
import type ICodeGenApi from "../../types/ICodeGenApi";

/** Get typed generator reference */
function gen(): ICodeGenApi {
  return CodeGenState.generator as ICodeGenApi;
}

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

  CodeGenState.needsString = true;

  const target = gen().generateAssignmentTarget(ctx.targetCtx);
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
  if (!structTypeInfo) {
    throw new Error(
      `Error: Unknown struct variable '${structName}' in string assignment`,
    );
  }

  const structType = structTypeInfo.baseType;
  const fieldType = CodeGenState.symbolTable?.getStructFieldType(
    structType,
    fieldName,
  );
  if (!fieldType) {
    throw new Error(
      `Error: Unknown field '${fieldName}' on struct '${structType}' in string assignment`,
    );
  }

  return fieldType;
}

/**
 * Get struct type from a variable name.
 *
 * Shared helper for struct field handlers.
 */
function getStructType(structName: string): string {
  const structTypeInfo = CodeGenState.getVariableTypeInfo(structName);
  if (!structTypeInfo) {
    throw new Error(
      `Error: Unknown struct variable '${structName}' in string assignment`,
    );
  }
  return structTypeInfo.baseType;
}

/**
 * Handle this.member string: this.name <- "value"
 */
function handleStringThisMember(ctx: IAssignmentContext): string {
  if (!CodeGenState.currentScope) {
    throw new Error("Error: 'this' can only be used inside a scope");
  }

  validateNotCompound(ctx);

  const memberName = ctx.identifiers[0];
  const scopedName = `${CodeGenState.currentScope}_${memberName}`;
  const typeInfo = CodeGenState.getVariableTypeInfo(scopedName);
  const capacity = typeInfo!.stringCapacity!;

  CodeGenState.needsString = true;

  const target = gen().generateAssignmentTarget(ctx.targetCtx);
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

  CodeGenState.needsString = true;

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

  CodeGenState.needsString = true;

  const index = gen().generateExpression(ctx.subscripts[0]);
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

  if (!dimensions || dimensions.length === 0) {
    throw new Error(
      `Error: Cannot determine string capacity for struct field '${structType}.${fieldName}'`,
    );
  }

  // String arrays: dimensions are [array_size, string_capacity+1]
  // -1 because we added +1 for null terminator during symbol collection
  const capacity = dimensions.at(-1)! - 1;

  CodeGenState.needsString = true;

  const index = gen().generateExpression(ctx.subscripts[0]);
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
