/**
 * Bitmap field assignment handlers (ADR-065).
 *
 * Handles assignments to bitmap fields:
 * - BITMAP_FIELD: flags.Mode <- 3, gss[1].fl.Mode <- 3, this.fl.A <- true
 * - REGISTER_MEMBER_BITMAP_FIELD: MOTOR.CTRL.Running <- true, Scope.GPIO7.ICR1.LED <- value
 */
import invariant from "../../../../../utils/invariant";
import AdrProvenance from "../../../../../instrumentation/AdrProvenance";
import type IBitmapFieldLayout from "../../../../../types/IBitmapFieldLayout";
import AssignmentKind from "../../../../../types/AssignmentKind";
import IAssignmentContext from "../../../../2-Plan/types/IAssignmentContext";
import BitUtils from "../../../../../utils/BitUtils";
import TAssignmentHandler from "./TAssignmentHandler";
import RegisterAccessMode from "../../../../../utils/RegisterAccessMode";
import type TranspileState from "../../../../TranspileState";

/**
 * Validate and get bitmap field info, throwing appropriate errors.
 */
function getBitmapFieldInfo(
  bitmapType: string,
  fieldName: string,
  state: TranspileState,
): IBitmapFieldLayout {
  const fields = state.symbols!.bitmapFields.get(bitmapType);
  // Two statements, because `asserts condition` narrows a REFERENCE, not an
  // arbitrary expression: asserting `fields?.has(...)` leaves `fields` itself
  // possibly-undefined for the line below.
  invariant(
    fields,
    `every bitmap the classifier routed here was collected by the resolver (missing type '${bitmapType}')`,
  );
  invariant(
    fields.has(fieldName),
    `the classifier and this handler agree on the bitmap field key ('${fieldName}' on '${bitmapType}')`,
  );

  const fieldInfo = fields.get(fieldName)!;

  // A compound operator on a bitmap field never reaches here: pass 2.1 rejects
  // it as E0857 on the chain's typed final step (#2159), and a literal too
  // wide for the field as E0881 from the bitmap's layouts (#1322).

  return fieldInfo;
}

/**
 * A bitmap field write: the field's bits of the bitmap's backing scalar,
 * written by `BitUtils`, whose width decisions read the backing type (#1668).
 * A write-1 register member takes a plain write, never a read-modify-write:
 * the member cannot be read (#1776).
 */
function writeBitmapField(
  target: string,
  bitmapType: string,
  fieldName: string,
  ctx: IAssignmentContext,
  writeOnly: boolean,
): string {
  const field = getBitmapFieldInfo(bitmapType, fieldName, ctx.state);
  const storage = ctx.state.symbols!.bitmapBackingType.get(bitmapType);
  invariant(
    storage,
    `a bitmap the resolver collected has a backing type ('${bitmapType}')`,
  );
  const value = ctx.generatedValue;
  if (field.width === 1) {
    return writeOnly
      ? BitUtils.writeOnlySingleBit(target, field.offset, value, storage)
      : BitUtils.singleBitWrite(target, field.offset, value, storage);
  }
  return writeOnly
    ? BitUtils.writeOnlyMultiBit(
        target,
        field.offset,
        field.width,
        value,
        storage,
      )
    : BitUtils.multiBitWrite(target, field.offset, field.width, value, storage);
}

/**
 * A bitmap field of a register member, which is write-1 when the member's
 * access says so -- however the member is spelled.
 */
function writeRegisterMemberBitmapField(
  fullRegMember: string,
  fieldName: string,
  ctx: IAssignmentContext,
): string {
  const bitmapType = ctx.state.symbols!.registerMemberTypes.get(fullRegMember)!;
  const accessMod = ctx.state.symbols!.registerMemberAccess.get(fullRegMember);
  return writeBitmapField(
    fullRegMember,
    bitmapType,
    fieldName,
    ctx,
    RegisterAccessMode.isWriteOne(accessMod),
  );
}

/**
 * A field of a bitmap value, however the value is named -- a variable, an
 * element, a member, a parameter, through `this.` or `global.`: the target
 * renders as every other bit write's does, and the typer names the bitmap.
 * #1760 second review: rebuilt here from the source spelling, a shadowing
 * local's write went to the global, and a C parameter's (a pointer) was not
 * dereferenced.
 */
function handleBitmapField(ctx: IAssignmentContext): string {
  const bitmapType = ctx.target.last?.before?.bitmapTypeName;
  invariant(bitmapType, "the classifier routes a field of a bitmap value here");
  const fieldName = ctx.identifiers.at(-1);
  invariant(fieldName, "a bitmap field write names its field");
  return writeBitmapField(
    ctx.renderBitTarget(),
    bitmapType,
    fieldName,
    ctx,
    false,
  );
}

/**
 * A field of a register member, however the register is spelled: the typer
 * names the member (#2158), and its access decides the write.
 */
function handleRegisterMemberBitmapField(ctx: IAssignmentContext): string {
  const member = ctx.target.last?.beforeRegisterMember;
  invariant(member, "the classifier routes a field of a register member here");
  const fieldName = ctx.identifiers.at(-1);
  invariant(fieldName, "a bitmap field write names its field");
  return writeRegisterMemberBitmapField(member, fieldName, ctx);
}

/**
 * Note that ADR-034's rule fired, for the matrix's occupancy derivation.
 *
 * Every handler in this module IS that rule -- lowering a named bitmap field
 * to a mask-and-shift on its backing scalar -- so the recording sits at the
 * registration boundary below rather than in each body. A handler added to
 * that array is recorded by construction, where an in-body call per handler
 * would be one more chance to add a handler and forget the line.
 *
 * #1241: this is what lets ADR-034's matrix derive occupancy at all. Occupancy
 * comes from source POSITIONS, and a bitmap write that works emits no
 * diagnostic and so supplies none -- every fixture exercising these rules
 * counted as "a linked fixture with no derivable context", leaving all twelve
 * declared cells reading unoccupied no matter how many fixtures reached them.
 */
function recordingAdr034(handler: TAssignmentHandler): TAssignmentHandler {
  return (ctx) => {
    AdrProvenance.record("034", ctx.targetLine);
    return handler(ctx);
  };
}

/**
 * All bitmap handlers for registration.
 */
const declaredBitmapHandlers: ReadonlyArray<
  [AssignmentKind, TAssignmentHandler]
> = [
  [AssignmentKind.BITMAP_FIELD, handleBitmapField],
  [
    AssignmentKind.REGISTER_MEMBER_BITMAP_FIELD,
    handleRegisterMemberBitmapField,
  ],
];

const bitmapHandlers: ReadonlyArray<[AssignmentKind, TAssignmentHandler]> =
  declaredBitmapHandlers.map(
    ([kind, handler]): [AssignmentKind, TAssignmentHandler] => [
      kind,
      recordingAdr034(handler),
    ],
  );

export default bitmapHandlers;
