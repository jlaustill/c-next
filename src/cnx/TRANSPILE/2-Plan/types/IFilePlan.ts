import type TAtomicForm from "../../types/TAtomicForm";
import type IAssignmentSyntax from "../../../types/syntax/IAssignmentSyntax";
import type IProgramSyntax from "../../../types/syntax/IProgramSyntax";
import type TDeclarationSyntax from "../../../types/syntax/TDeclarationSyntax";
import type TExpression from "../../../types/syntax/TExpression";
import type TExpressionOf from "../../../types/syntax/TExpressionOf";
import type TPostfixOpSyntax from "../../../types/syntax/TPostfixOpSyntax";
import type TTypeSyntax from "../../../types/syntax/TTypeSyntax";
import type TValueBinding from "../../../types/TValueBinding";
import type IPlannedCast from "./IPlannedCast";
import type IPlannedClamp from "./IPlannedClamp";
import type IPlannedSliceSource from "./IPlannedSliceSource";
import type IPlannedExpectedType from "./IPlannedExpectedType";
import type IPlannedType from "./IPlannedType";
import type TNegativeMinimum from "./TNegativeMinimum";
import type TStructInitializerForm from "./TStructInitializerForm";

/**
 * 2.2 Plan's artifact for one file: every decision 2.3 Render reads, made
 * before any of the file is written. Render takes this and nothing else from
 * Plan (#1991).
 */
interface IFilePlan {
  /** 1.2's plain data for the file, which Render writes out */
  readonly program: IProgramSyntax;

  /** The file's own header, included first for its public interface, or null (#1164) */
  readonly selfInclude: string | null;

  /** Which private scope consts are inlined, not declared (#282) */
  readonly inlinedConsts: ReadonlySet<TDeclarationSyntax>;

  /** What each `sizeof(Name)` operand's name binds to (#1974) */
  readonly sizeofBindings: ReadonlyMap<
    TExpressionOf<"sizeof">,
    TValueBinding | null
  >;

  /** Which `sizeof(a.b)` operands are member accesses (#1972) */
  readonly sizeofMemberAccesses: ReadonlySet<TExpressionOf<"sizeof">>;

  /** The plan for each type the file writes */
  readonly types: ReadonlyMap<TTypeSyntax, IPlannedType>;

  /** For each written `=`/`!=` comparison, whether it compares strings (ADR-045) */
  readonly comparisons: ReadonlyMap<TExpression, boolean>;

  /** For each written cast, the type it converts from and whether and how it saturates (ADR-024) */
  readonly casts: ReadonlyMap<
    TExpressionOf<"cast">,
    Pick<IPlannedCast, "operandType" | "clampForm">
  >;

  /** Each written `-` literal 2.3 spells as its type's minimum macro (MISRA 10.3) */
  readonly negativeMinimums: ReadonlyMap<
    TExpressionOf<"unary">,
    TNegativeMinimum
  >;
  /** MISRA 10.1: each written `~` of an unsigned operand, and the C type it is cast back to */
  readonly complementCasts: ReadonlyMap<TExpressionOf<"unary">, string>;
  /** ADR-007: each written range read of a named float's bits, through a union */
  readonly floatBitReads: ReadonlySet<TPostfixOpSyntax>;
  /** ADR-007: each assignment target that writes a float's bits, through a union */
  readonly floatBitWrites: ReadonlySet<TExpression>;
  /** ADR-049: how each written atomic read-modify-write is written */
  readonly atomicForms: ReadonlyMap<IAssignmentSyntax, TAtomicForm>;
  /** ADR-051: each written `safe_div`/`safe_mod` call, whose helper 2.2 required */
  readonly safeDivisions: ReadonlySet<TExpression>;
  /** ADR-044: each written `clamp` integer `+ - *` chain, and the helpers it calls */
  readonly clampChains: ReadonlyMap<TExpression, IPlannedClamp>;
  /** ADR-044: each compound write that calls a clamp helper, and which */
  readonly compoundClamps: ReadonlyMap<
    IAssignmentSyntax,
    { operation: string; cnxType: string }
  >;
  /** #1081: how each slice write reads its source */
  readonly sliceSources: ReadonlyMap<IAssignmentSyntax, IPlannedSliceSource>;
  /** ADR-044: every `<operation>_<cnxType>` helper the file calls */
  readonly clampOps: ReadonlySet<string>;
  /** #1927: the C types the file's text uses, which decide `<stdint.h>`/`<stdbool.h>` */
  readonly cTypes: ReadonlySet<string>;
  /** The type each value is rendered against; a value not listed has none */
  readonly expectedTypes: ReadonlyMap<TExpression, IPlannedExpectedType>;
  /** ADR-014: how each written struct initializer is written */
  readonly structInitializers: ReadonlyMap<
    TExpressionOf<"structInitializer">,
    TStructInitializerForm
  >;
}

export default IFilePlan;
