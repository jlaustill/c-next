/**
 * Unit tests for CleanCommand
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import CleanCommand from "../CleanCommand";
import InputExpansion from "../../transpiler/data/InputExpansion";
import * as fs from "node:fs";

// Mock dependencies
vi.mock("../../transpiler/data/InputExpansion");
vi.mock("node:fs", async () => {
  const actual = await vi.importActual("node:fs");
  return {
    ...actual,
    existsSync: vi.fn(),
    statSync: vi.fn(),
    unlinkSync: vi.fn(),
  };
});

describe("CleanCommand", () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    // Default: all paths exist as directories
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.statSync).mockReturnValue({ isFile: () => false } as fs.Stats);
  });

  describe("execute", () => {
    it("reports no output directory when outDir is empty", () => {
      CleanCommand.execute(["src/"], "", undefined);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        "No output directory specified. Nothing to clean.",
      );
    });

    it("reports no files found when no .cnx files exist", () => {
      vi.mocked(InputExpansion.expandInputs).mockReturnValue([]);

      CleanCommand.execute(["src/"], "build/", undefined);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        "No .cnx files found. Nothing to clean.",
      );
    });

    it("handles InputExpansion errors gracefully", () => {
      vi.mocked(InputExpansion.expandInputs).mockImplementation(() => {
        throw new Error("Path not found");
      });

      CleanCommand.execute(["nonexistent/"], "build/", undefined);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Error: Error: Path not found",
      );
    });

    it("deletes generated .c and .h files", () => {
      vi.mocked(InputExpansion.expandInputs).mockReturnValue([
        "/project/src/main.cnx",
      ]);

      // Mock unlinkSync to succeed for all calls
      vi.mocked(fs.unlinkSync).mockImplementation(() => {});

      CleanCommand.execute(["/project/src/"], "/project/build/", undefined);

      // Should try to delete .c, .cpp, .h, .hpp files
      expect(fs.unlinkSync).toHaveBeenCalledTimes(4);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        "Deleted 4 generated file(s).",
      );
    });

    it("uses separate header directory when specified", () => {
      vi.mocked(InputExpansion.expandInputs).mockReturnValue([
        "/project/src/main.cnx",
      ]);

      vi.mocked(fs.unlinkSync).mockImplementation(() => {});

      CleanCommand.execute(
        ["/project/src/"],
        "/project/build/",
        "/project/include/",
      );

      // Verify header files go to include dir
      const unlinkCalls = vi.mocked(fs.unlinkSync).mock.calls;
      const paths = unlinkCalls.map((call) => call[0] as string);

      // .c and .cpp go to build/
      expect(paths.some((p) => p.includes("build") && p.endsWith(".c"))).toBe(
        true,
      );
      expect(paths.some((p) => p.includes("build") && p.endsWith(".cpp"))).toBe(
        true,
      );

      // .h and .hpp go to include/
      expect(paths.some((p) => p.includes("include") && p.endsWith(".h"))).toBe(
        true,
      );
      expect(
        paths.some((p) => p.includes("include") && p.endsWith(".hpp")),
      ).toBe(true);
    });

    it("reports nothing to delete when files don't exist", () => {
      vi.mocked(InputExpansion.expandInputs).mockReturnValue([
        "/project/src/main.cnx",
      ]);

      // Mock unlinkSync to throw ENOENT (file doesn't exist)
      const enoentError = new Error("ENOENT") as NodeJS.ErrnoException;
      enoentError.code = "ENOENT";
      vi.mocked(fs.unlinkSync).mockImplementation(() => {
        throw enoentError;
      });

      CleanCommand.execute(["/project/src/"], "/project/build/", undefined);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        "No generated files found to delete.",
      );
    });

    it("handles file deletion errors other than ENOENT", () => {
      vi.mocked(InputExpansion.expandInputs).mockReturnValue([
        "/project/src/main.cnx",
      ]);

      // Mock unlinkSync to throw permission error
      const permError = new Error("EACCES") as NodeJS.ErrnoException;
      permError.code = "EACCES";
      vi.mocked(fs.unlinkSync).mockImplementation(() => {
        throw permError;
      });

      CleanCommand.execute(["/project/src/"], "/project/build/", undefined);

      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith(
        "No generated files found to delete.",
      );
    });

    it("handles single file inputs with basename fallback", () => {
      vi.mocked(InputExpansion.expandInputs).mockReturnValue([
        "/project/src/main.cnx",
      ]);

      // Mock the input as a file (not directory)
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.statSync).mockReturnValue({
        isFile: () => true,
      } as fs.Stats);

      vi.mocked(fs.unlinkSync).mockImplementation(() => {});

      CleanCommand.execute(
        ["/project/src/main.cnx"],
        "/project/build/",
        undefined,
      );

      // Should use basename (main) since input is a file not directory
      const unlinkCalls = vi.mocked(fs.unlinkSync).mock.calls;
      const paths = unlinkCalls.map((call) => call[0] as string);

      expect(paths.some((p) => p.includes("main.c"))).toBe(true);
    });

    it("handles .cnext extension files", () => {
      vi.mocked(InputExpansion.expandInputs).mockReturnValue([
        "/project/src/test.cnext",
      ]);

      vi.mocked(fs.unlinkSync).mockImplementation(() => {});

      CleanCommand.execute(["/project/src/"], "/project/build/", undefined);

      const unlinkCalls = vi.mocked(fs.unlinkSync).mock.calls;
      const paths = unlinkCalls.map((call) => call[0] as string);

      // Should strip .cnext and add proper extensions
      expect(paths.some((p) => p.includes("test.c"))).toBe(true);
      expect(paths.some((p) => p.includes("test.h"))).toBe(true);
    });

    it("preserves directory structure in output", () => {
      vi.mocked(InputExpansion.expandInputs).mockReturnValue([
        "/project/src/drivers/uart.cnx",
      ]);

      vi.mocked(fs.unlinkSync).mockImplementation(() => {});

      CleanCommand.execute(["/project/src/"], "/project/build/", undefined);

      const unlinkCalls = vi.mocked(fs.unlinkSync).mock.calls;
      const paths = unlinkCalls.map((call) => call[0] as string);

      // Should preserve drivers/ subdirectory
      expect(paths.some((p) => p.includes("drivers") && p.endsWith(".c"))).toBe(
        true,
      );
    });
  });
});
