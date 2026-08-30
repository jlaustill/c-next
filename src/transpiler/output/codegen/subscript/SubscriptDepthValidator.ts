/**
 * Issue #1106: shared validation for subscript-chain depth.
 *
 * Per ADR-036 each subscript peels one array dimension; per ADR-007 a scalar
 * integer/float may be bit-indexed once. So a base variable allows at most
 * `arrayDimensions + 1` subscript operations. A deeper chain indexes a value
 * that is not an array — e.g. `flags[4][3]` on a scalar `u8`, where `flags[4]`
 * is already a single bit.
 *
 * This is the single source of truth for the "how many subscripts may this
 * base take?" decision. Both the assignment (write) path
 * (AssignmentClassifier) and the expression (read) path
 * (PostfixExpressionGenerator) consult it, so the two paths cannot diverge.
 * It owns the *counting* as well as the check (`countLeadingSubscripts`):
 * sharing only the check while each path re-derived the count would leave the
 * two agreeing by coincidence rather than by construction.
 */
import TTypeInfo from "../../../types/TTypeInfo";
import TypeCheckUtils from "../../../../utils/TypeCheckUtils";
import CodeGenErrors from "../helpers/CodeGenErrors";

/**
 * Structural shape common to `postfixOp` (read path) and `postfixTargetOp`
 * (write path). Both expose their bracket contents via `expression()`: a
 * subscript has 1 (`[i]`) or 2 (`[start, width]`), while a member access or a
 * call has none.
 */
interface IPostfixOpLike {
  expression(): unknown[];
}

class SubscriptDepthValidator {
  /**
   * Count the leading run of subscript operations applied directly to a base,
   * starting at `startIndex` and stopping at the first operation that changes
   * the type (member access or call) — after that, subsequent subscripts apply
   * to a different value, not to this base.
   *
   * Counts OPERATIONS, not expressions: the bit range `flags[4, 3]` is one
   * operation with two expressions, whereas the chain `flags[4][3]` is two
   * operations with one each. Conflating them would reject valid bit ranges.
   *
   * `startIndex` skips operations already consumed in identifying the base —
   * on the read path `this.flags[4][3]` parses as `this` plus the ops
   * `.flags`, `[4]`, `[3]`, so the member op is skipped with `startIndex: 1`.
   * The write path needs no offset: `assignmentTarget` consumes the `this .
   * IDENTIFIER` prefix in the grammar rule itself, so its ops are subscripts
   * from index 0.
   */
  static countLeadingSubscripts(
    ops: readonly IPostfixOpLike[],
    startIndex = 0,
  ): number {
    let count = 0;
    for (let index = startIndex; index < ops.length; index++) {
      if (ops[index].expression().length === 0) {
        break;
      }
      count++;
    }
    return count;
  }

  /**
   * Validate that a leading run of `subscriptOpCount` subscript operations
   * applied directly to `varName` (declared type `typeInfo`) is within range.
   *
   * Only integer/float bases are checked: those are the bit-indexable scalar
   * element types (ADR-007). Strings are char arrays with their own semantics,
   * bitmaps reject bracket indexing elsewhere, and struct/other bases are
   * handled by the member-access paths — none are validated here.
   *
   * @throws when the chain is deeper than `arrayDimensions + 1`.
   */
  static validate(
    typeInfo: TTypeInfo | undefined,
    subscriptOpCount: number,
    varName: string,
    line: number,
  ): void {
    if (!typeInfo || typeInfo.isString || typeInfo.isBitmap) {
      return;
    }

    const isBitIndexable =
      TypeCheckUtils.isInteger(typeInfo.baseType) ||
      TypeCheckUtils.isFloat(typeInfo.baseType);
    if (!isBitIndexable) {
      return;
    }

    const arrayDimensions = typeInfo.arrayDimensions?.length ?? 0;
    const maxDepth = arrayDimensions + 1;
    if (subscriptOpCount > maxDepth) {
      throw CodeGenErrors.tooManySubscripts(
        line,
        varName,
        typeInfo.baseType,
        arrayDimensions,
      );
    }
  }
}

export default SubscriptDepthValidator;
