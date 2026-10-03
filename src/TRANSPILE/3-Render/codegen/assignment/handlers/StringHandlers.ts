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
import AssignmentKind from "../../../../../types/AssignmentKind";
import IAssignmentContext from "../../../../2-Plan/types/IAssignmentContext";
import StringUtils from "../../../../../utils/StringUtils";
import TypeCheckUtils from "../../../../../utils/TypeCheckUtils";
import TAssignmentHandler from "./TAssignmentHandler";
import invariant from "../../../../../utils/invariant";
import type TranspileState from "../../../../TranspileState";

// #1322: `validateNotCompound` is gone -- E0857 in pass 2.1. It was defined
// here AND in the sibling handler, verbatim: one rule, two copies, in a group
// of six.

/**
 * The declared capacity of the `string<N>` an assignment writes.
 *
 * #1668 (C7): the target's binding answers it. Three handlers used to ask a
 * registry by a key each spelled -- bare, scope-qualified, or an array's base
 * name -- and one had to match the classifier's spelling or throw.
 */
function capacityOf(ctx: IAssignmentContext): number {
  return ctx.target.typeInfo!.stringCapacity!;
}

/**
 * Emit a bounded copy into whatever `ctx.targetCtx` renders to, sized by the
 * `string<N>` the target writes.
 *
 * STRING_SIMPLE, STRING_GLOBAL and STRING_THIS_MEMBER differed in exactly one
 * thing: how a registry key was spelled, before #1668 (C7) bound the target
 * once. Everything downstream of that -- the
 * `<string.h>` requirement, the target, the `strncpy`/null-terminator pair --
 * was derived separately for the bare key and the qualified one, so a change
 * to how a bounded string copy is emitted needed two edits that nothing held
 * together. CLAUDE.md: "Single source of truth means the _decision_."
 */
function copyIntoAssignmentTarget(ctx: IAssignmentContext): string {
  const capacity = capacityOf(ctx);

  const target = ctx.renderTarget();
  return StringUtils.copyWithNull(target, ctx.generatedValue, capacity);
}

/*
 * #1450 box 4: four `requireInclude("string")` calls stood in this file, and
 * two more in `StringDeclHelper`. All six were redundant, and measuring WHY
 * corrected the reason I first wrote here.
 *
 * `needsString` is not settled early. It is OVER-DETERMINED: instrumenting
 * `ctx.state.requireInclude` shows three independent channels raising it
 * across the corpus -- the effect channel during expression rendering (632
 * raises), `CodeGenerator.generateType` (~499), and type registration (460).
 * Any one of them can be removed and the flag is still true, which is exactly
 * why deleting these six moved not one byte across 1250 fixtures.
 *
 * So this removes duplication, not a render-time decision: the same
 * consequence was being derived in six more places than the three that already
 * derive it. `needsString` remains a fact rendering raises, and making it a
 * PLAN fact is still open under box 4.
 *
 * The three that remain are worth their own card, because the two largest fire
 * on the mere PRESENCE of a string type rather than on a call into the string
 * library -- which is #1095's root cause, stated there as a symptom.
 */

/**
 * Handle simple string assignments (STRING_SIMPLE and STRING_GLOBAL).
 */
function handleSimpleStringAssignment(ctx: IAssignmentContext): string {
  return copyIntoAssignmentTarget(ctx);
}

/**
 * Get struct field type information.
 *
 * Shared helper for struct field string handlers.
 */
function getStructFieldType(
  ctx: IAssignmentContext,
  fieldName: string,
  state: TranspileState,
): string {
  // Issue #831: one source of truth for struct fields, reached through the
  // accessor rather than the table -- #1322's scope-declared-struct key
  // fallback lives there, and a bare table lookup misses it.
  const structType = getStructType(ctx);
  const fieldType = state.getStructFieldInfo(structType, fieldName)?.type;
  // Same shape as the `structTypeInfo` guard `getStructType` carries: the
  // classifier already required `getStructFieldType` truthy and
  // `TypeCheckUtils.isString` before producing this kind, so a miss here is the
  // transpiler contradicting itself, not the author's program.
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
function getStructType(ctx: IAssignmentContext): string {
  const structTypeInfo = ctx.target.rootTypeInfo;
  // #1322: unreachable -- STRING_STRUCT_FIELD is produced only via
  // `AssignmentClassifier._resolveStructType`, which reads the same bound
  // root and returns null when it has no type -- and load-bearing, since it
  // narrows the type for the next line. So it is an invariant.
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
  return copyIntoAssignmentTarget(ctx);
}

/**
 * Handle struct.field string: person.name <- "Alice"
 */
function handleStringStructField(ctx: IAssignmentContext): string {
  const structName = ctx.identifiers[0];
  const fieldName = ctx.identifiers[1];

  const fieldType = getStructFieldType(ctx, fieldName, ctx.state);
  const capacity = TypeCheckUtils.getStringCapacity(fieldType)!;

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
  const name = ctx.identifiers[0];
  const capacity = capacityOf(ctx);

  const index = ctx.renderSubscript(0);
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
  const structName = ctx.identifiers[0];
  const fieldName = ctx.identifiers[1];

  const structType = getStructType(ctx);
  const dimensions = ctx.state
    .symbols!.structFieldDimensions.get(structType)
    ?.get(fieldName);

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

  const index = ctx.renderSubscript(0);
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
