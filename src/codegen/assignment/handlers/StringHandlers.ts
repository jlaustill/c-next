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
import IHandlerDeps from "./IHandlerDeps";
import StringUtils from "../../../utils/StringUtils";
import TypeCheckUtils from "../../../utils/TypeCheckUtils";
import TAssignmentHandler from "./TAssignmentHandler";

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
 * Handle simple string variable: str <- "hello"
 */
function handleStringSimple(
  ctx: IAssignmentContext,
  deps: IHandlerDeps,
): string {
  validateNotCompound(ctx);

  const id = ctx.identifiers[0];
  const typeInfo = deps.typeRegistry.get(id);
  const capacity = typeInfo!.stringCapacity!;

  deps.markNeedsString();

  const target = deps.generateAssignmentTarget(ctx.targetCtx);
  return StringUtils.copyWithNull(target, ctx.generatedValue, capacity);
}

/**
 * Handle this.member string: this.name <- "value"
 */
function handleStringThisMember(
  ctx: IAssignmentContext,
  deps: IHandlerDeps,
): string {
  if (!deps.currentScope) {
    throw new Error("Error: 'this' can only be used inside a scope");
  }

  validateNotCompound(ctx);

  const memberName = ctx.identifiers[0];
  const scopedName = `${deps.currentScope}_${memberName}`;
  const typeInfo = deps.typeRegistry.get(scopedName);
  const capacity = typeInfo!.stringCapacity!;

  deps.markNeedsString();

  const target = deps.generateAssignmentTarget(ctx.targetCtx);
  return StringUtils.copyWithNull(target, ctx.generatedValue, capacity);
}

/**
 * Handle global.member string: global.name <- "value"
 */
function handleStringGlobal(
  ctx: IAssignmentContext,
  deps: IHandlerDeps,
): string {
  validateNotCompound(ctx);

  const id = ctx.identifiers[0];
  const typeInfo = deps.typeRegistry.get(id);
  const capacity = typeInfo!.stringCapacity!;

  deps.markNeedsString();

  const target = deps.generateAssignmentTarget(ctx.targetCtx);
  return StringUtils.copyWithNull(target, ctx.generatedValue, capacity);
}

/**
 * Handle struct.field string: person.name <- "Alice"
 */
function handleStringStructField(
  ctx: IAssignmentContext,
  deps: IHandlerDeps,
): string {
  validateNotCompound(ctx);

  const structName = ctx.identifiers[0];
  const fieldName = ctx.identifiers[1];

  const structTypeInfo = deps.typeRegistry.get(structName);
  const structType = structTypeInfo!.baseType;
  const structFields = deps.symbols.structFields.get(structType);
  const fieldType = structFields!.get(fieldName)!;
  const capacity = TypeCheckUtils.getStringCapacity(fieldType)!;

  deps.markNeedsString();

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
function handleStringArrayElement(
  ctx: IAssignmentContext,
  deps: IHandlerDeps,
): string {
  validateNotCompound(ctx);

  const name = ctx.identifiers[0];
  const typeInfo = deps.typeRegistry.get(name);
  const capacity = typeInfo!.stringCapacity!;

  deps.markNeedsString();

  const index = deps.generateExpression(ctx.subscripts[0]);
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
function handleStringStructArrayElement(
  ctx: IAssignmentContext,
  deps: IHandlerDeps,
): string {
  validateNotCompound(ctx);

  const structName = ctx.identifiers[0];
  const fieldName = ctx.identifiers[1];

  const structTypeInfo = deps.typeRegistry.get(structName);
  const structType = structTypeInfo!.baseType;
  const dimensions = deps.symbols.structFieldDimensions
    .get(structType)
    ?.get(fieldName);

  // String arrays: dimensions are [array_size, string_capacity+1]
  // -1 because we added +1 for null terminator during symbol collection
  const capacity = dimensions![dimensions!.length - 1] - 1;

  deps.markNeedsString();

  const index = deps.generateExpression(ctx.subscripts[0]);
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
  [AssignmentKind.STRING_SIMPLE, handleStringSimple],
  [AssignmentKind.STRING_THIS_MEMBER, handleStringThisMember],
  [AssignmentKind.STRING_GLOBAL, handleStringGlobal],
  [AssignmentKind.STRING_STRUCT_FIELD, handleStringStructField],
  [AssignmentKind.STRING_ARRAY_ELEMENT, handleStringArrayElement],
  [AssignmentKind.STRING_STRUCT_ARRAY_ELEMENT, handleStringStructArrayElement],
];

export default stringHandlers;
