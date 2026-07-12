/**
 * Unit tests for SubscriptDepthValidator (Issue #1106).
 */
import { describe, it, expect } from "vitest";
import SubscriptDepthValidator from "../SubscriptDepthValidator";
import TTypeInfo from "../../types/TTypeInfo";

const scalar = (baseType: string): TTypeInfo => ({
  baseType,
  bitWidth: 8,
  isArray: false,
  isConst: false,
});

const array = (baseType: string, dims: number[]): TTypeInfo => ({
  baseType,
  bitWidth: 8,
  isArray: true,
  arrayDimensions: dims,
  isConst: false,
});

describe("SubscriptDepthValidator", () => {
  it("allows a single subscript (bit index) on a scalar integer", () => {
    expect(() =>
      SubscriptDepthValidator.validate(scalar("u8"), 1, "flags", 1),
    ).not.toThrow();
  });

  it("rejects a second subscript on a scalar integer", () => {
    expect(() =>
      SubscriptDepthValidator.validate(scalar("u8"), 2, "flags", 9),
    ).toThrow(/too many subscripts on 'flags'.*is not an array/s);
  });

  it("rejects an over-deep chain on a scalar float", () => {
    expect(() =>
      SubscriptDepthValidator.validate(scalar("f32"), 2, "value", 3),
    ).toThrow(/too many subscripts/);
  });

  it("allows arrayDimensions + 1 subscripts (element bit index)", () => {
    expect(() =>
      SubscriptDepthValidator.validate(array("u8", [16]), 2, "buffer", 1),
    ).not.toThrow();
  });

  it("rejects more than arrayDimensions + 1 subscripts", () => {
    expect(() =>
      SubscriptDepthValidator.validate(array("u8", [16]), 3, "buffer", 1),
    ).toThrow(/1-dimensional 'u8' array/);
  });

  it("does not validate an unknown (undefined) type", () => {
    expect(() =>
      SubscriptDepthValidator.validate(undefined, 5, "x", 1),
    ).not.toThrow();
  });

  it("does not validate string types (own semantics)", () => {
    const str: TTypeInfo = {
      baseType: "char",
      bitWidth: 8,
      isArray: false,
      isConst: false,
      isString: true,
      stringCapacity: 32,
    };
    expect(() =>
      SubscriptDepthValidator.validate(str, 3, "name", 1),
    ).not.toThrow();
  });

  it("does not validate bitmap types (bracket indexing rejected elsewhere)", () => {
    const bitmap: TTypeInfo = {
      baseType: "u8",
      bitWidth: 8,
      isArray: false,
      isConst: false,
      isBitmap: true,
      bitmapTypeName: "Flags",
    };
    expect(() =>
      SubscriptDepthValidator.validate(bitmap, 3, "f", 1),
    ).not.toThrow();
  });

  it("does not validate non-bit-indexable base types (e.g. structs)", () => {
    expect(() =>
      SubscriptDepthValidator.validate(scalar("Point"), 3, "p", 1),
    ).not.toThrow();
  });
});
