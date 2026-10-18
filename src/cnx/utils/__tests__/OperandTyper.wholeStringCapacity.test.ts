import { describe, expect, it } from "vitest";
import OperandTyper from "../OperandTyper";
import type IChainStep from "../../types/IChainStep";
import type IOperandType from "../../types/IOperandType";
import type TSubscriptKind from "../../types/TSubscriptKind";

/**
 * #1731 review: the one rule 2.1's E0715 and 2.2's bounded copy both read --
 * a write is a copy when its last step lands on one whole `string<N>`.
 */
function operand(
  typeName: string,
  stringCapacity: number | null,
  dimensions: number[] = [],
): IOperandType {
  return {
    typeName,
    cType: null,
    dimensions,
    category: "none",
    bitWidth: null,
    stringCapacity,
    enumTypeName: null,
    bitmapTypeName: null,
    overflow: null,
    hasSideEffect: false,
    form: { kind: "declared" },
    binding: null,
  };
}

function step(
  subscript: TSubscriptKind | null,
  after: IOperandType | null,
): IChainStep {
  return {
    before: null,
    subscript,
    after,
    property: subscript === null ? "name" : null,
    callee: null,
    beforeNamesType: false,
    beforeIsBitField: false,
  };
}

const string8 = operand("string<8>", 8);

describe("OperandTyper.wholeStringCapacity", () => {
  it("is the capacity of a field or element that is one string<N>", () => {
    expect(OperandTyper.wholeStringCapacity(step(null, string8))).toBe(8);
    expect(
      OperandTyper.wholeStringCapacity(step("array_element", string8)),
    ).toBe(8);
  });

  it("is null for a slice or a bit of a string", () => {
    // `buffer[0, 2] <- value` writes two bytes of the string, not the string
    // (tests/scope/scope-string-param-slice.test.cnx)
    expect(
      OperandTyper.wholeStringCapacity(step("array_slice", string8)),
    ).toBeNull();
    expect(
      OperandTyper.wholeStringCapacity(step("bit_single", string8)),
    ).toBeNull();
    expect(
      OperandTyper.wholeStringCapacity(step("bit_range", string8)),
    ).toBeNull();
  });

  it("is null for a row of strings, an unsized string or no string", () => {
    expect(
      OperandTyper.wholeStringCapacity(
        step("array_element", operand("string<8>", 8, [3])),
      ),
    ).toBeNull();
    expect(
      OperandTyper.wholeStringCapacity(step(null, operand("string", null))),
    ).toBeNull();
    expect(
      OperandTyper.wholeStringCapacity(step(null, operand("u8", null))),
    ).toBeNull();
    expect(OperandTyper.wholeStringCapacity(step(null, null))).toBeNull();
  });
});
