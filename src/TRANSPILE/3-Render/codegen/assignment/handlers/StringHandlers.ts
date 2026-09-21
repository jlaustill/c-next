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
import AssignmentKind from "../../../../../transpiler/types/AssignmentKind";
import IAssignmentContext from "../../../../../transpiler/types/IAssignmentContext";
import StringUtils from "../../../../../utils/StringUtils";
import TypeCheckUtils from "../../../../../utils/TypeCheckUtils";
import TAssignmentHandler from "./TAssignmentHandler";
import CodeGenState from "../../../../../transpiler/state/CodeGenState";
import invariant from "../../../../../utils/invariant";
import QualifiedNameGenerator from "../../utils/QualifiedNameGenerator";

// #1322: `validateNotCompound` is gone -- E0857 in pass 2.1. It was defined
// here AND in the sibling handler, verbatim: one rule, two copies, in a group
// of six.

/**
 * The declared capacity of the `string<N>` a registry key names.
 *
 * Three handlers asked the registry this, byte for byte. The key each one
 * builds differs -- bare, scope-qualified, or an array's base name -- but the
 * question and its answer do not, so only the key is the caller's business.
 */
function capacityOf(registryKey: string): number {
  const typeInfo = CodeGenState.getVariableTypeInfo(registryKey);
  return typeInfo!.stringCapacity!;
}

/**
 * Emit a bounded copy into whatever `ctx.targetCtx` renders to, sized by the
 * `string<N>` that `registryKey` names.
 *
 * STRING_SIMPLE, STRING_GLOBAL and STRING_THIS_MEMBER differ in exactly one
 * thing: how the registry key is spelled. Everything downstream of that -- the
 * `<string.h>` requirement, the target, the `strncpy`/null-terminator pair --
 * was derived separately for the bare key and the qualified one, so a change
 * to how a bounded string copy is emitted needed two edits that nothing held
 * together. CLAUDE.md: "Single source of truth means the _decision_."
 */
function copyIntoAssignmentTarget(
  ctx: IAssignmentContext,
  registryKey: string,
): string {
  const capacity = capacityOf(registryKey);

  const target = ctx.renderTarget();
  return StringUtils.copyWithNull(target, ctx.generatedValue, capacity);
}

/*
 * #1450 box 4: four `requireInclude("string")` calls stood in this file, and
 * two more in `StringDeclHelper`. All six were redundant, and measuring WHY
 * corrected the reason I first wrote here.
 *
 * `needsString` is not settled early. It is OVER-DETERMINED: instrumenting
 * `CodeGenState.requireInclude` shows three independent channels raising it
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
 * Handle simple string assignments (STRING_SIMPLE and STRING_GLOBAL), whose
 * registry key is the identifier as written.
 */
function handleSimpleStringAssignment(ctx: IAssignmentContext): string {
  return copyIntoAssignmentTarget(ctx, ctx.identifiers[0]);
}

/**
 * Get struct field type information.
 *
 * Shared helper for struct field string handlers.
 */
function getStructFieldType(structName: string, fieldName: string): string {
  // Issue #831: Use SymbolTable as single source of truth for struct fields
  const structType = getStructType(structName);
  const fieldType = CodeGenState.symbolTable?.getStructFieldType(
    structType,
    fieldName,
  );
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
  const memberName = ctx.identifiers[0];
  // The key must match `_classifyThisMemberString`
  // (AssignmentClassifier.ts:846), which hits the same map to decide whether to
  // route here at all -- so a mismatch makes `capacityOf`'s `!` throw rather
  // than return a wrong answer. #1357 deleted a comment that said this
  // alongside a claim that had gone false ("leaf key, matching forMember"); the
  // false half deserved deleting and this half did not.
  const scopedName = QualifiedNameGenerator.forMember(
    CodeGenState.currentScopePath,
    memberName,
  );
  return copyIntoAssignmentTarget(ctx, scopedName);
}

/**
 * Handle struct.field string: person.name <- "Alice"
 */
function handleStringStructField(ctx: IAssignmentContext): string {
  const structName = ctx.identifiers[0];
  const fieldName = ctx.identifiers[1];

  const fieldType = getStructFieldType(structName, fieldName);
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
  const capacity = capacityOf(name);

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
