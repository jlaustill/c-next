/**
 * Special assignment handlers (ADR-065).
 *
 * Handles special compound assignment operations:
 * - ATOMIC_RMW: atomic counter +<- 1
 * - OVERFLOW_CLAMP: clamp u8 saturated +<- 200
 */
import AssignmentKind from "../../../../../transpiler/types/AssignmentKind";
import IAssignmentContext from "../../../../../transpiler/types/IAssignmentContext";
import TypeCheckUtils from "../../../../../utils/TypeCheckUtils";
import TAssignmentHandler from "./TAssignmentHandler";
import CodeGenState from "../../../../../transpiler/state/CodeGenState";
import TTypeInfo from "../../../../../transpiler/types/TTypeInfo";
import QualifiedNameGenerator from "../../../../../utils/QualifiedNameGenerator";
import AdrProvenance from "../../../../../transpiler/state/AdrProvenance";

/** Maps C operators to clamp helper operation names */
const CLAMP_OP_MAP: Record<string, string> = {
  "+=": "add",
  "-=": "sub",
  "*=": "mul",
};

/**
 * Get typeInfo for assignment target.
 * Handles simple identifiers, this.member, and global.member patterns.
 */
function getTargetTypeInfo(ctx: IAssignmentContext): {
  typeInfo: TTypeInfo | undefined;
} {
  const id = ctx.identifiers[0];

  // Simple identifier
  if (ctx.isSimpleIdentifier) {
    return { typeInfo: CodeGenState.getVariableTypeInfo(id) };
  }

  // this.member: lookup using scoped name
  if (ctx.isSimpleThisAccess && CodeGenState.currentScopePath) {
    const scopedName = QualifiedNameGenerator.forMember(
      CodeGenState.currentScopePath,
      id,
    );
    return { typeInfo: CodeGenState.getVariableTypeInfo(scopedName) };
  }

  // global.member: lookup using direct name
  if (ctx.isSimpleGlobalAccess) {
    return { typeInfo: CodeGenState.getVariableTypeInfo(id) };
  }

  // Fallback to direct lookup
  return { typeInfo: CodeGenState.getVariableTypeInfo(id) };
}

/**
 * Handle atomic read-modify-write: atomic counter +<- 1
 *
 * Delegates to CodeGenerator's generateAtomicRMW which uses
 * LDREX/STREX on supported platforms or PRIMASK otherwise.
 */
function handleAtomicRMW(ctx: IAssignmentContext): string {
  const { typeInfo } = getTargetTypeInfo(ctx);
  const target = ctx.renderTarget();

  return CodeGenState.requireGenerator().generateAtomicRMW(
    target,
    ctx.cOp,
    ctx.generatedValue,
    typeInfo!,
  );
}

/**
 * Handle overflow-clamped compound assignment: clamp u8 saturated +<- 200
 *
 * Generates calls to cnx_clamp_add_u8, cnx_clamp_sub_u8, etc.
 * Only applies to integers (floats use native C arithmetic with infinity).
 */
function handleOverflowClamp(ctx: IAssignmentContext): string {
  const { typeInfo } = getTargetTypeInfo(ctx);
  const target = ctx.renderTarget();

  // Floats use native C arithmetic (overflow to infinity)
  if (TypeCheckUtils.usesNativeArithmetic(typeInfo!.baseType)) {
    return `${target} ${ctx.cOp} ${ctx.generatedValue};`;
  }

  const helperOp = CLAMP_OP_MAP[ctx.cOp];

  if (helperOp) {
    // #1241: ADR-044's rule firing on the COMPOUND form. The expression form
    // (`a <- a + b`) records in BinaryExprGenerator; this is the `a +<- b` path,
    // which reaches a different decision and would otherwise leave every
    // compound-only fixture without a derivable context. Recorded past the float and
    // helper-lookup gates, so only an actually-lowered clamp claims a cell.
    AdrProvenance.record("044", ctx.targetLine);
    CodeGenState.markClampOpUsed(helperOp, typeInfo!.baseType);
    return `${target} = cnx_clamp_${helperOp}_${typeInfo!.baseType}(${target}, ${ctx.generatedValue});`;
  }

  // Fallback for operators without clamp helpers (e.g., /=)
  return `${target} ${ctx.cOp} ${ctx.generatedValue};`;
}

/**
 * All special handlers for registration.
 */
const specialHandlers: ReadonlyArray<[AssignmentKind, TAssignmentHandler]> = [
  [AssignmentKind.ATOMIC_RMW, handleAtomicRMW],
  [AssignmentKind.OVERFLOW_CLAMP, handleOverflowClamp],
];

export default specialHandlers;
