/**
 * Unit tests for InputExpansion
 *
 * Tests CLI input expansion functionality - converting file paths and directories
 * into lists of .cnx files.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { resolve } from "node:path";
import InputExpansion from "../InputExpansion";

// Mock node:fs module
vi.mock("node:fs", () => ({
  existsSync: vi.fn(),
  statSync: vi.fn(),
  readdirSync: vi.fn(),
}));

import { existsSync, statSync, readdirSync } from "node:fs";

const mockExistsSync = vi.mocked(existsSync);
const mockStatSync = vi.mocked(statSync);
const mockReaddirSync = vi.mocked(readdirSync);

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

    it("rejects .c files", () => {
      expect(() =>
        InputExpansion.validateFileExtension("/path/to/file.c"),
      ).toThrow("Cannot process implementation file 'file.c'");
    });

    it("rejects .cpp files", () => {
      expect(() =>
        InputExpansion.validateFileExtension("/path/to/file.cpp"),
      ).toThrow("Cannot process implementation file 'file.cpp'");
    });

    it("rejects .cc files", () => {
      expect(() =>
        InputExpansion.validateFileExtension("/path/to/file.cc"),
      ).toThrow("Cannot process implementation file 'file.cc'");
    });

    it("rejects .cxx files", () => {
      expect(() =>
        InputExpansion.validateFileExtension("/path/to/file.cxx"),
      ).toThrow("Cannot process implementation file 'file.cxx'");
    });

    it("rejects .c++ files", () => {
      expect(() =>
        InputExpansion.validateFileExtension("/path/to/file.c++"),
      ).toThrow("Cannot process implementation file 'file.c++'");
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

    it("provides helpful message for implementation files", () => {
      expect(() =>
        InputExpansion.validateFileExtension("/path/to/impl.c"),
      ).toThrow(
        "If you need to include this file, create a header (.h) instead",
      );
    });

    it("provides helpful message for unknown extensions", () => {
      expect(() =>
        InputExpansion.validateFileExtension("/path/to/file.js"),
      ).toThrow("C-Next only accepts .cnx or .cnext files");
    });
  });

  describe("findCNextFiles", () => {
    it("finds .cnx files in directory", () => {
      mockReaddirSync.mockReturnValue([
        { name: "main.cnx", isFile: () => true, isDirectory: () => false },
        { name: "util.cnx", isFile: () => true, isDirectory: () => false },
      ] as unknown as ReturnType<typeof readdirSync>);

      const result = InputExpansion.findCNextFiles("/project");

      expect(result).toHaveLength(2);
      expect(result).toContainEqual(resolve("/project", "main.cnx"));
      expect(result).toContainEqual(resolve("/project", "util.cnx"));
    });

    it("finds .cnext files in directory", () => {
      mockReaddirSync.mockReturnValue([
        { name: "main.cnext", isFile: () => true, isDirectory: () => false },
      ] as unknown as ReturnType<typeof readdirSync>);

      const result = InputExpansion.findCNextFiles("/project");

      expect(result).toHaveLength(1);
      expect(result[0]).toContain("main.cnext");
    });

    it("ignores non-cnx files", () => {
      mockReaddirSync.mockReturnValue([
        { name: "main.cnx", isFile: () => true, isDirectory: () => false },
        { name: "readme.md", isFile: () => true, isDirectory: () => false },
        { name: "config.json", isFile: () => true, isDirectory: () => false },
      ] as unknown as ReturnType<typeof readdirSync>);

      const result = InputExpansion.findCNextFiles("/project");

      expect(result).toHaveLength(1);
      expect(result[0]).toContain("main.cnx");
    });

    it("skips hidden directories", () => {
      mockReaddirSync.mockImplementation((dir) => {
        if (String(dir).includes(".git")) {
          return [
            {
              name: "hidden.cnx",
              isFile: () => true,
              isDirectory: () => false,
            },
          ] as unknown as ReturnType<typeof readdirSync>;
        }
        return [
          { name: ".git", isFile: () => false, isDirectory: () => true },
          { name: "main.cnx", isFile: () => true, isDirectory: () => false },
        ] as unknown as ReturnType<typeof readdirSync>;
      });

      const result = InputExpansion.findCNextFiles("/project");

      expect(result).toHaveLength(1);
      expect(result[0]).toContain("main.cnx");
    });

    it("skips node_modules directory", () => {
      mockReaddirSync.mockImplementation((dir) => {
        if (String(dir).includes("node_modules")) {
          return [
            { name: "dep.cnx", isFile: () => true, isDirectory: () => false },
          ] as unknown as ReturnType<typeof readdirSync>;
        }
        return [
          {
            name: "node_modules",
            isFile: () => false,
            isDirectory: () => true,
          },
          { name: "main.cnx", isFile: () => true, isDirectory: () => false },
        ] as unknown as ReturnType<typeof readdirSync>;
      });

      const result = InputExpansion.findCNextFiles("/project");

      expect(result).toHaveLength(1);
      expect(result[0]).toContain("main.cnx");
    });

    it("skips build directory", () => {
      mockReaddirSync.mockImplementation((dir) => {
        if (String(dir).includes("build")) {
          return [
            {
              name: "output.cnx",
              isFile: () => true,
              isDirectory: () => false,
            },
          ] as unknown as ReturnType<typeof readdirSync>;
        }
        return [
          { name: "build", isFile: () => false, isDirectory: () => true },
          { name: "main.cnx", isFile: () => true, isDirectory: () => false },
        ] as unknown as ReturnType<typeof readdirSync>;
      });

      const result = InputExpansion.findCNextFiles("/project");

      expect(result).toHaveLength(1);
    });

    it("skips .pio directory (PlatformIO)", () => {
      mockReaddirSync.mockImplementation((dir) => {
        if (String(dir).includes(".pio")) {
          return [
            {
              name: "cached.cnx",
              isFile: () => true,
              isDirectory: () => false,
            },
          ] as unknown as ReturnType<typeof readdirSync>;
        }
        return [
          { name: ".pio", isFile: () => false, isDirectory: () => true },
          { name: "main.cnx", isFile: () => true, isDirectory: () => false },
        ] as unknown as ReturnType<typeof readdirSync>;
      });

      const result = InputExpansion.findCNextFiles("/project");

      expect(result).toHaveLength(1);
    });

    it("skips dist directory", () => {
      mockReaddirSync.mockImplementation((dir) => {
        if (String(dir).includes("dist")) {
          return [
            {
              name: "bundled.cnx",
              isFile: () => true,
              isDirectory: () => false,
            },
          ] as unknown as ReturnType<typeof readdirSync>;
        }
        return [
          { name: "dist", isFile: () => false, isDirectory: () => true },
          { name: "main.cnx", isFile: () => true, isDirectory: () => false },
        ] as unknown as ReturnType<typeof readdirSync>;
      });

      const result = InputExpansion.findCNextFiles("/project");

      expect(result).toHaveLength(1);
    });

    it("recursively scans subdirectories", () => {
      mockReaddirSync.mockImplementation((dir) => {
        const dirStr = String(dir);
        if (dirStr.endsWith("src")) {
          return [
            { name: "util.cnx", isFile: () => true, isDirectory: () => false },
          ] as unknown as ReturnType<typeof readdirSync>;
        }
        return [
          { name: "src", isFile: () => false, isDirectory: () => true },
          { name: "main.cnx", isFile: () => true, isDirectory: () => false },
        ] as unknown as ReturnType<typeof readdirSync>;
      });

      const result = InputExpansion.findCNextFiles("/project");

      expect(result).toHaveLength(2);
    });

    it("throws error when directory scan fails", () => {
      mockReaddirSync.mockImplementation(() => {
        throw new Error("Permission denied");
      });

      expect(() => InputExpansion.findCNextFiles("/protected")).toThrow(
        "Failed to scan directory /protected",
      );
    });

    it("returns empty array for empty directory", () => {
      mockReaddirSync.mockReturnValue(
        [] as unknown as ReturnType<typeof readdirSync>,
      );

      const result = InputExpansion.findCNextFiles("/empty");

      expect(result).toHaveLength(0);
    });
  });
});
