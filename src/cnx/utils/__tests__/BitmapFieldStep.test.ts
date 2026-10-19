import { describe, it, expect } from "vitest";
import BitmapFieldStep from "../BitmapFieldStep";
import type IChainStep from "../../types/IChainStep";
import type IOperandType from "../../types/IOperandType";
import type IBitmapFieldLayout from "../../types/IBitmapFieldLayout";

const layout = { offset: 2, width: 3 } as IBitmapFieldLayout;
const bitmapFields = new Map([["Flags", new Map([["Mode", layout]])]]);

function step(fields: Partial<IChainStep>): IChainStep {
  return {
    before: null,
    subscript: null,
    property: null,
    member: null,
    ...fields,
  } as IChainStep;
}

const flags = {
  bitmapTypeName: "Flags",
  dimensions: [],
} as unknown as IOperandType;

describe("BitmapFieldStep.fieldOf", () => {
  it("names the field a step reads off a bitmap value", () => {
    expect(
      BitmapFieldStep.fieldOf(
        step({ before: flags, member: "Mode" }),
        bitmapFields,
      ),
    ).toEqual({ bitmapType: "Flags", fieldName: "Mode", layout });
  });

  it("names none for a field the bitmap does not declare", () => {
    expect(
      BitmapFieldStep.fieldOf(
        step({ before: flags, member: "Nope" }),
        bitmapFields,
      ),
    ).toBeNull();
  });
});

describe("BitmapFieldStep.writesBits", () => {
  const field = { bitmapType: "Flags", fieldName: "Mode", layout };

  it("is a bit index, a bit range or a bitmap field", () => {
    expect(
      BitmapFieldStep.writesBits(step({ subscript: "bit_single" }), null),
    ).toBe(true);
    expect(
      BitmapFieldStep.writesBits(step({ subscript: "bit_range" }), null),
    ).toBe(true);
    expect(BitmapFieldStep.writesBits(step({ member: "Mode" }), field)).toBe(
      true,
    );
  });

  it("is not a whole-value write or an array element", () => {
    expect(BitmapFieldStep.writesBits(undefined, null)).toBe(false);
    expect(BitmapFieldStep.writesBits(step({ member: "x" }), null)).toBe(false);
    expect(
      BitmapFieldStep.writesBits(step({ subscript: "array_element" }), null),
    ).toBe(false);
  });
});
