import type IProgramSyntax from "../../../types/syntax/IProgramSyntax";
import type TDeclarationSyntax from "../../../types/syntax/TDeclarationSyntax";
import type TExpression from "../../../types/syntax/TExpression";
import type TExpressionOf from "../../../types/syntax/TExpressionOf";
import type TPostfixOpSyntax from "../../../types/syntax/TPostfixOpSyntax";
import type TTypeSyntax from "../../../types/syntax/TTypeSyntax";
import type TValueBinding from "../../../types/TValueBinding";
import type IPlannedCast from "./IPlannedCast";
import type IPlannedType from "./IPlannedType";
import type TNegativeMinimum from "./TNegativeMinimum";

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
  /** ADR-007: each written range read of a named float's bits, through a union */
  readonly floatBitReads: ReadonlySet<TPostfixOpSyntax>;
  /** ADR-007: each assignment target that writes a float's bits, through a union */
  readonly floatBitWrites: ReadonlySet<TExpression>;
}

export default IFilePlan;
