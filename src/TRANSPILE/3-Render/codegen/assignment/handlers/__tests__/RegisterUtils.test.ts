/**
 * Unit tests for RegisterUtils.
 * Tests shared utilities for register assignment handlers.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import RegisterUtils from "../RegisterUtils";
import TranspileState from "../../../../../TranspileState";
import HandlerTestUtils from "./handlerTestUtils";

let state = new TranspileState();

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

  describe("extractBitRangeParams", () => {
    beforeEach(() => {
      state = new TranspileState();
      HandlerTestUtils.setupMockGenerator(state, {
        generateExpression: vi
          .fn()
          .mockImplementation((ctx) => ctx?.mockExpr ?? "0"),
      });
    });

    it("extracts start, width, and mask from subscripts", () => {
      const result = RegisterUtils.extractBitRangeParams("4", "8");

      expect(result.start).toBe("4");
      expect(result.width).toBe("8");
      // BitUtils.generateMask returns optimized hex for common widths
      expect(result.mask).toBe("0xFFU");
    });

    it("handles dynamic expressions", () => {
      const result = RegisterUtils.extractBitRangeParams("offset", "width_var");

      expect(result.start).toBe("offset");
      expect(result.width).toBe("width_var");
      expect(result.mask).toBe("((1U << width_var) - 1)");
    });
  });

  describe("tryGenerateMMIO", () => {
    beforeEach(() => {
      state = new TranspileState();
      HandlerTestUtils.setupMockSymbols(state, {
        registerBaseAddresses: new Map([["GPIO7", "0x401B8000"]]),
        registerMemberOffsets: new Map([["GPIO7_DR", "0x00"]]),
      });
    });

    it("returns success:false when start is not constant", () => {
      HandlerTestUtils.setupMockGenerator(state, {
        tryEvaluateConstant: vi.fn().mockReturnValue(undefined),
      });

      const result = RegisterUtils.tryGenerateMMIO(
        "GPIO7_DR",
        "GPIO7",
        undefined,
        undefined,
        "0xFF",
        state,
      );

      expect(result.success).toBe(false);
    });

    it("returns success:false when start is not byte-aligned", () => {
      HandlerTestUtils.setupMockGenerator(state, {
        tryEvaluateConstant: vi
          .fn()
          .mockReturnValueOnce(3) // start = 3 (not byte-aligned)
          .mockReturnValueOnce(8), // width = 8
      });

      const result = RegisterUtils.tryGenerateMMIO(
        "GPIO7_DR",
        "GPIO7",
        3,
        8,
        "0xFF",
        state,
      );

      expect(result.success).toBe(false);
    });

    it("returns success:false when width is not standard (8, 16, 32)", () => {
      HandlerTestUtils.setupMockGenerator(state, {
        tryEvaluateConstant: vi
          .fn()
          .mockReturnValueOnce(0) // start = 0
          .mockReturnValueOnce(12), // width = 12 (non-standard)
      });

      const result = RegisterUtils.tryGenerateMMIO(
        "GPIO7_DR",
        "GPIO7",
        0,
        12,
        "0xFF",
        state,
      );

      expect(result.success).toBe(false);
    });

    it("returns success:false when base address not found", () => {
      HandlerTestUtils.setupMockGenerator(state, {
        tryEvaluateConstant: vi
          .fn()
          .mockReturnValueOnce(0)
          .mockReturnValueOnce(8),
      });
      HandlerTestUtils.setupMockSymbols(state, {
        registerBaseAddresses: new Map(), // No base address
        registerMemberOffsets: new Map([["GPIO7_DR", "0x00"]]),
      });

      const result = RegisterUtils.tryGenerateMMIO(
        "GPIO7_DR",
        "GPIO7",
        0,
        8,
        "0xFF",
        state,
      );

      expect(result.success).toBe(false);
    });

    it("generates MMIO for byte-aligned 8-bit write at offset 0", () => {
      HandlerTestUtils.setupMockGenerator(state, {
        tryEvaluateConstant: vi
          .fn()
          .mockReturnValueOnce(0) // start = 0
          .mockReturnValueOnce(8), // width = 8
      });

      const result = RegisterUtils.tryGenerateMMIO(
        "GPIO7_DR",
        "GPIO7",
        0,
        8,
        "0xFF",
        state,
      );

      expect(result.success).toBe(true);
      expect(result.statement).toBe(
        "*((volatile uint8_t*)(0x401B8000 + 0x00)) = (0xFF);",
      );
    });

    it("generates MMIO for byte-aligned 16-bit write with byte offset", () => {
      HandlerTestUtils.setupMockGenerator(state, {
        tryEvaluateConstant: vi
          .fn()
          .mockReturnValueOnce(8) // start = 8 (1 byte offset)
          .mockReturnValueOnce(16), // width = 16
      });

      const result = RegisterUtils.tryGenerateMMIO(
        "GPIO7_DR",
        "GPIO7",
        8,
        16,
        "0xABCD",
        state,
      );

      expect(result.success).toBe(true);
      expect(result.statement).toBe(
        "*((volatile uint16_t*)(0x401B8000 + 0x00 + 1)) = (0xABCD);",
      );
    });

    it("generates MMIO for 32-bit write", () => {
      HandlerTestUtils.setupMockGenerator(state, {
        tryEvaluateConstant: vi
          .fn()
          .mockReturnValueOnce(0) // start = 0
          .mockReturnValueOnce(32), // width = 32
      });

      const result = RegisterUtils.tryGenerateMMIO(
        "GPIO7_DR",
        "GPIO7",
        0,
        32,
        "0xDEADBEEF",
        state,
      );

      expect(result.success).toBe(true);
      expect(result.statement).toBe(
        "*((volatile uint32_t*)(0x401B8000 + 0x00)) = (0xDEADBEEF);",
      );
    });
  });

  describe("generateWriteOnlyBitRange", () => {
    it("generates write-only bit range assignment", () => {
      const result = RegisterUtils.generateWriteOnlyBitRange(
        "GPIO7_DR",
        "value",
        "((1U << 8) - 1)",
        "4",
      );

      expect(result).toBe("GPIO7_DR = ((value & ((1U << 8) - 1)) << 4);");
    });
  });

  describe("generateRmwBitRange", () => {
    it("generates read-modify-write bit range assignment", () => {
      const result = RegisterUtils.generateRmwBitRange(
        "GPIO7_DR",
        "value",
        "((1U << 8) - 1)",
        "4",
      );

      expect(result).toBe(
        "GPIO7_DR = (GPIO7_DR & ~(((1U << 8) - 1) << 4)) | ((value & ((1U << 8) - 1)) << 4);",
      );
    });
  });
});
