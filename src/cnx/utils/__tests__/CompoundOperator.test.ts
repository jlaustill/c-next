import { describe, expect, it } from "vitest";
import CompoundOperator from "../CompoundOperator";
import ASSIGNMENT_OPERATORS from "../../types/syntax/ASSIGNMENT_OPERATORS";

describe("CompoundOperator.binaryOf", () => {
  // `x op<- y` is `x <- x op y`, and each spelling is its operator followed
  // by `<-`, so every entry is checked without a second copy of the table
  it.each(ASSIGNMENT_OPERATORS.filter((spelling) => spelling !== "<-"))(
    "%s applies the operator it is spelled with",
    (spelling) => {
      expect(`${CompoundOperator.binaryOf(spelling)}<-`).toBe(spelling);
    },
  );

  it.each(["<-", "=", "+="])("%s is not a compound assignment", (text) => {
    expect(CompoundOperator.binaryOf(text)).toBeNull();
  });
});
