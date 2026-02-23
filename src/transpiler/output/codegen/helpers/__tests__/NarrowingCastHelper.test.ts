/**
 * Unit tests for NarrowingCastHelper
 * Issue #845: MISRA C:2012 Rule 10.3 compliance
 */

import { describe, it, expect, beforeEach } from "vitest";
import NarrowingCastHelper from "../NarrowingCastHelper.js";
import CodeGenState from "../../../../state/CodeGenState.js";

describe("NarrowingCastHelper", () => {
  beforeEach(() => {
    CodeGenState.reset();
  });

  describe("needsCast", () => {
    it("returns false for same type", () => {
      expect(NarrowingCastHelper.needsCast("u32", "u32")).toBe(false);
      expect(NarrowingCastHelper.needsCast("u8", "u8")).toBe(false);
      expect(NarrowingCastHelper.needsCast("bool", "bool")).toBe(false);
    });

    it("returns false for widening (u8 -> u32)", () => {
      expect(NarrowingCastHelper.needsCast("u8", "u32")).toBe(false);
      expect(NarrowingCastHelper.needsCast("u16", "u32")).toBe(false);
      expect(NarrowingCastHelper.needsCast("i8", "i32")).toBe(false);
    });

    it("returns true for narrowing (u32 -> u8)", () => {
      expect(NarrowingCastHelper.needsCast("u32", "u8")).toBe(true);
      expect(NarrowingCastHelper.needsCast("u32", "u16")).toBe(true);
      expect(NarrowingCastHelper.needsCast("i32", "i8")).toBe(true);
    });

    it("returns true for int -> smaller unsigned (C promotion result)", () => {
      expect(NarrowingCastHelper.needsCast("int", "u8")).toBe(true);
      expect(NarrowingCastHelper.needsCast("int", "u16")).toBe(true);
      expect(NarrowingCastHelper.needsCast("int", "i8")).toBe(true);
    });

    it("returns true for int -> bool (different essential type)", () => {
      expect(NarrowingCastHelper.needsCast("int", "bool")).toBe(true);
      expect(NarrowingCastHelper.needsCast("u32", "bool")).toBe(true);
    });

    it("returns true for char literal type -> u8", () => {
      expect(NarrowingCastHelper.needsCast("int", "u8")).toBe(true);
    });
  });
});
