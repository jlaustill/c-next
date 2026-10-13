import COMPOUND_BINARY_OPERATORS from "../types/syntax/COMPOUND_BINARY_OPERATORS";
import type TBinaryOperator from "../types/syntax/TBinaryOperator";

const BY_SPELLING: ReadonlyMap<string, TBinaryOperator> = new Map(
  Object.entries(COMPOUND_BINARY_OPERATORS),
);

class CompoundOperator {
  /** The binary operator a compound assignment applies; null for `<-` */
  static binaryOf(assignmentOperator: string): TBinaryOperator | null {
    return BY_SPELLING.get(assignmentOperator) ?? null;
  }
}

export default CompoundOperator;
