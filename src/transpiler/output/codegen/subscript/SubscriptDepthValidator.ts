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
 */
import TTypeInfo from "../types/TTypeInfo";
import TypeCheckUtils from "../../../../utils/TypeCheckUtils";
import CodeGenErrors from "../helpers/CodeGenErrors";

class SubscriptDepthValidator {
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
