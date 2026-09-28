/**
 * Bitmap field assignment handlers (ADR-065).
 *
 * Handles assignments to bitmap fields:
 * - BITMAP_FIELD_SINGLE_BIT: flags.Running <- true
 * - BITMAP_FIELD_MULTI_BIT: flags.Mode <- 3
 * - BITMAP_ARRAY_ELEMENT_FIELD: bitmapArr[i].Field <- value
 * - STRUCT_MEMBER_BITMAP_FIELD: device.flags.Active <- true
 * - REGISTER_MEMBER_BITMAP_FIELD: MOTOR.CTRL.Running <- true
 * - SCOPED_REGISTER_MEMBER_BITMAP_FIELD: Scope.GPIO7.ICR1.LED <- value
 */
import invariant from "../../../../../utils/invariant";
import AdrProvenance from "../../../../../instrumentation/AdrProvenance";
import type IBitmapFieldLayout from "../../../../../transpiler/types/IBitmapFieldLayout";
import AssignmentKind from "../../../../../transpiler/types/AssignmentKind";
import IAssignmentContext from "../../../../2-Plan/types/IAssignmentContext";
import BitUtils from "../../../../../utils/BitUtils";
import TAssignmentHandler from "./TAssignmentHandler";
import QualifiedCName from "../../../../../utils/QualifiedCName";
import QualifiedNameGenerator from "../../../../../utils/QualifiedNameGenerator";
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

  // #1322: compound assignment on this target is E0857 in pass 2.1, and a
  // literal too wide for the field is E0881 -- decided from the bitmap's
  // layouts and the value's own text, so it no longer waits for this handler
  // to have resolved the field first.

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
 * Handle register member bitmap field: MOTOR.CTRL.Running <- true
 */
function handleRegisterMemberBitmapField(ctx: IAssignmentContext): string {
  const regName = ctx.identifiers[0];
  const memberName = ctx.identifiers[1];
  const fieldName = ctx.identifiers[2];

  const fullRegMember = QualifiedCName.fromParts([regName, memberName]);
  return writeRegisterMemberBitmapField(fullRegMember, fieldName, ctx);
}

/**
 * Handle scoped register member bitmap field.
 * Two patterns:
 * - this.REG.MEMBER.field (hasThis=true, 3 identifiers) - scope from currentScopePath
 * - Scope.REG.MEMBER.field (hasThis=false, 4 identifiers) - scope from identifiers[0]
 */
function handleScopedRegisterMemberBitmapField(
  ctx: IAssignmentContext,
): string {
  // #1285: the two branches do not hold the same kind of thing. `this.` has the
  // declaring scope PATH; `Scope.` has a scope NAME written in the source. They
  // were both flattened to a string here, which is what let one leaf-only encoder
  // serve both. Each branch now builds the register name its own way.
  let fullRegName: string;
  let regName: string;
  let memberName: string;
  let fieldName: string;

  if (ctx.hasThis) {
    // this.REG.MEMBER.field - 3 identifiers
    regName = ctx.identifiers[0];
    memberName = ctx.identifiers[1];
    fieldName = ctx.identifiers[2];
    fullRegName = QualifiedNameGenerator.forMember(
      ctx.state.currentScopePath,
      regName,
    );
  } else {
    // Scope.REG.MEMBER.field - 4 identifiers
    const scopeName = ctx.identifiers[0];
    regName = ctx.identifiers[1];
    memberName = ctx.identifiers[2];
    fieldName = ctx.identifiers[3];

    fullRegName = QualifiedCName.fromParts([scopeName, regName]);
  }

  // A register MEMBER is qualified by its register, textually -- not by a scope.
  const fullRegMember = QualifiedCName.fromParts([fullRegName, memberName]);
  return writeRegisterMemberBitmapField(fullRegMember, fieldName, ctx);
}

/**
 * Note that ADR-034's rule fired, for the matrix's occupancy derivation.
 *
 * Every handler in this module IS that rule -- lowering a named bitmap field
 * to a mask-and-shift on its backing scalar -- so the recording sits at the
 * registration boundary below rather than in six bodies. A seventh handler
 * added to that array is recorded by construction, where six in-body calls
 * would be six chances to add a handler and forget the line.
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
  [AssignmentKind.BITMAP_FIELD_SINGLE_BIT, handleBitmapField],
  [AssignmentKind.BITMAP_FIELD_MULTI_BIT, handleBitmapField],
  [AssignmentKind.BITMAP_ARRAY_ELEMENT_FIELD, handleBitmapField],
  [AssignmentKind.STRUCT_MEMBER_BITMAP_FIELD, handleBitmapField],
  [
    AssignmentKind.REGISTER_MEMBER_BITMAP_FIELD,
    handleRegisterMemberBitmapField,
  ],
  [
    AssignmentKind.SCOPED_REGISTER_MEMBER_BITMAP_FIELD,
    handleScopedRegisterMemberBitmapField,
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
