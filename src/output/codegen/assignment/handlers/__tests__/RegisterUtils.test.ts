/**
 * Unit tests for RegisterUtils.
 * Tests shared utilities for register assignment handlers.
 */

import { describe, expect, it } from "vitest";
import RegisterUtils from "../RegisterUtils";

describe("RegisterUtils", () => {
  describe("isWriteOnlyRegister", () => {
    it("returns true for 'wo' (write-only)", () => {
      expect(RegisterUtils.isWriteOnlyRegister("wo")).toBe(true);
    });

    it("returns true for 'w1s' (write-1-to-set)", () => {
      expect(RegisterUtils.isWriteOnlyRegister("w1s")).toBe(true);
    });

    it("returns true for 'w1c' (write-1-to-clear)", () => {
      expect(RegisterUtils.isWriteOnlyRegister("w1c")).toBe(true);
    });

    it("returns false for 'rw' (read-write)", () => {
      expect(RegisterUtils.isWriteOnlyRegister("rw")).toBe(false);
    });

    it("returns false for 'ro' (read-only)", () => {
      expect(RegisterUtils.isWriteOnlyRegister("ro")).toBe(false);
    });

    it("returns false for undefined", () => {
      expect(RegisterUtils.isWriteOnlyRegister(undefined)).toBe(false);
    });

    it("returns false for empty string", () => {
      expect(RegisterUtils.isWriteOnlyRegister("")).toBe(false);
    });
  });
});
