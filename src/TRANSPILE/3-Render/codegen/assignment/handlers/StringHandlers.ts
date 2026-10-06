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
import TAssignmentHandler from "./TAssignmentHandler";
import invariant from "../../../../../utils/invariant";
import type IOperandType from "../../../../../types/IOperandType";
import OperandTyper from "../../../../../utils/OperandTyper";

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
 * The capacity of the `string<N>` a struct-field write copies into.
 *
 * #1737: the typer's step for the field answers it -- `person.name`'s last
 * step reads the field, `config.items[0]`'s indexes it -- the step the
 * classifier routed on. This read a struct-field accessor and, for an array,
 * the field-dimensions map, keyed by a struct name the handler re-derived.
 */
function fieldCapacityOf(field: IOperandType | null | undefined): number {
  const capacity = OperandTyper.scalarStringCapacity(field);
  invariant(
    capacity !== null,
    "the classifier routes a write to a string<N> field here",
  );
  return capacity;
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

  const capacity = fieldCapacityOf(ctx.target.last?.after);

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

  const capacity = fieldCapacityOf(ctx.target.last?.after);

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
