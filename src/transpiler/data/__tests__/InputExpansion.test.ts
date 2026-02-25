/**
 * Unit tests for InputExpansion
 *
 * Tests CLI input expansion functionality - converting file paths
 * into validated lists of .cnx files.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { resolve } from "node:path";
import InputExpansion from "../InputExpansion";

// Mock node:fs module
vi.mock("node:fs", () => ({
  existsSync: vi.fn(),
  statSync: vi.fn(),
}));

import { existsSync, statSync } from "node:fs";

const mockExistsSync = vi.mocked(existsSync);
const mockStatSync = vi.mocked(statSync);

// ============================================================================
// Test Helpers
// ============================================================================

function mockFile(path: string): void {
  mockExistsSync.mockImplementation((p) => p === path || p === resolve(path));
  mockStatSync.mockReturnValue({
    isFile: () => true,
    isDirectory: () => false,
  } as ReturnType<typeof statSync>);
}

// ============================================================================
// Tests
// ============================================================================

describe("InputExpansion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("expandInputs", () => {
    it("expands single .cnx file", () => {
      const filePath = "/project/main.cnx";
      mockFile(filePath);

      const result = InputExpansion.expandInputs([filePath]);

      expect(result).toHaveLength(1);
      expect(result[0]).toBe(resolve(filePath));
    });

    it("expands single .cnext file", () => {
      const filePath = "/project/main.cnext";
      mockFile(filePath);

      const result = InputExpansion.expandInputs([filePath]);

      expect(result).toHaveLength(1);
      expect(result[0]).toBe(resolve(filePath));
    });

    it("throws error for non-existent file", () => {
      mockExistsSync.mockReturnValue(false);

      expect(() => InputExpansion.expandInputs(["/nonexistent.cnx"])).toThrow(
        "Input not found: /nonexistent.cnx",
      );
    });

    it("removes duplicate files", () => {
      const filePath = "/project/main.cnx";
      mockFile(filePath);

      const result = InputExpansion.expandInputs([filePath, filePath]);

      expect(result).toHaveLength(1);
    });

    it("handles multiple input files", () => {
      mockExistsSync.mockReturnValue(true);
      mockStatSync.mockReturnValue({
        isFile: () => true,
        isDirectory: () => false,
      } as ReturnType<typeof statSync>);

      const result = InputExpansion.expandInputs([
        "/project/a.cnx",
        "/project/b.cnx",
      ]);

      expect(result).toHaveLength(2);
    });
  });

  describe("validateFileExtension", () => {
    it("accepts .cnx files", () => {
      expect(() =>
        InputExpansion.validateFileExtension("/path/to/file.cnx"),
      ).not.toThrow();
    });

    it("accepts .cnext files", () => {
      expect(() =>
        InputExpansion.validateFileExtension("/path/to/file.cnext"),
      ).not.toThrow();
    });

    it("accepts .c files as entry points", () => {
      expect(() =>
        InputExpansion.validateFileExtension("/path/to/main.c"),
      ).not.toThrow();
    });

    it("accepts .cpp files as entry points", () => {
      expect(() =>
        InputExpansion.validateFileExtension("/path/to/main.cpp"),
      ).not.toThrow();
    });

    it("accepts .cc files as entry points", () => {
      expect(() =>
        InputExpansion.validateFileExtension("/path/to/main.cc"),
      ).not.toThrow();
    });

    it("accepts .cxx files as entry points", () => {
      expect(() =>
        InputExpansion.validateFileExtension("/path/to/main.cxx"),
      ).not.toThrow();
    });

    it("accepts .c++ files as entry points", () => {
      expect(() =>
        InputExpansion.validateFileExtension("/path/to/main.c++"),
      ).not.toThrow();
    });

    it("rejects unknown extensions", () => {
      expect(() =>
        InputExpansion.validateFileExtension("/path/to/file.txt"),
      ).toThrow("Invalid file extension '.txt'");
    });

    it("rejects header files", () => {
      expect(() =>
        InputExpansion.validateFileExtension("/path/to/file.h"),
      ).toThrow("Invalid file extension '.h'");
    });

    it("provides helpful message for unknown extensions", () => {
      expect(() =>
        InputExpansion.validateFileExtension("/path/to/file.js"),
      ).toThrow(
        "C-Next only accepts .cnx, .cnext, .c, .cpp, .cc, .cxx, or .c++ files",
      );
    });
  });

  describe("isCppEntryPoint", () => {
    it("returns true for .c files", () => {
      expect(InputExpansion.isCppEntryPoint("/path/to/main.c")).toBe(true);
    });

    it("returns true for .cpp files", () => {
      expect(InputExpansion.isCppEntryPoint("/path/to/main.cpp")).toBe(true);
    });

    it("returns true for .cc files", () => {
      expect(InputExpansion.isCppEntryPoint("/path/to/main.cc")).toBe(true);
    });

    it("returns true for .cxx files", () => {
      expect(InputExpansion.isCppEntryPoint("/path/to/main.cxx")).toBe(true);
    });

    it("returns true for .c++ files", () => {
      expect(InputExpansion.isCppEntryPoint("/path/to/main.c++")).toBe(true);
    });

    it("returns false for .cnx files", () => {
      expect(InputExpansion.isCppEntryPoint("/path/to/file.cnx")).toBe(false);
    });

    it("returns false for .cnext files", () => {
      expect(InputExpansion.isCppEntryPoint("/path/to/file.cnext")).toBe(false);
    });
  });
});
