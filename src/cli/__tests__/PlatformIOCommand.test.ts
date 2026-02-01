/**
 * Unit tests for PlatformIOCommand
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import PlatformIOCommand from "../PlatformIOCommand";
import * as fs from "node:fs";

// Mock fs module
vi.mock("node:fs", async () => {
  const actual = await vi.importActual("node:fs");
  return {
    ...actual,
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
    unlinkSync: vi.fn(),
  };
});

describe("PlatformIOCommand", () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let processExitSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    // Mock process.exit to throw so execution stops (simulates real exit behavior)
    processExitSpy = vi.spyOn(process, "exit").mockImplementation((code) => {
      throw new Error(`process.exit(${code})`);
    });
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    processExitSpy.mockRestore();
  });

  describe("install", () => {
    it("fails when platformio.ini doesn't exist", () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      expect(() => PlatformIOCommand.install()).toThrow("process.exit(1)");

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Error: platformio.ini not found in current directory",
      );
    });

    it("creates cnext_build.py script", () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue("[env:esp32]\n");

      PlatformIOCommand.install();

      // Should write cnext_build.py
      const writeCalls = vi.mocked(fs.writeFileSync).mock.calls;
      const scriptCall = writeCalls.find((call) =>
        (call[0] as string).includes("cnext_build.py"),
      );

      expect(scriptCall).toBeDefined();
      expect(scriptCall?.[1]).toContain("Import");
      expect(scriptCall?.[1]).toContain("transpile_cnext");
    });

    it("adds extra_scripts to platformio.ini when not present", () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(
        "[env:esp32]\nboard = esp32dev\n",
      );

      PlatformIOCommand.install();

      const writeCalls = vi.mocked(fs.writeFileSync).mock.calls;
      const iniCall = writeCalls.find((call) =>
        (call[0] as string).includes("platformio.ini"),
      );

      expect(iniCall).toBeDefined();
      expect(iniCall?.[1]).toContain("extra_scripts = pre:cnext_build.py");
    });

    it("appends to existing extra_scripts", () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(
        "[env:esp32]\nextra_scripts = post:other.py\n",
      );

      PlatformIOCommand.install();

      const writeCalls = vi.mocked(fs.writeFileSync).mock.calls;
      const iniCall = writeCalls.find((call) =>
        (call[0] as string).includes("platformio.ini"),
      );

      expect(iniCall).toBeDefined();
      expect(iniCall?.[1]).toContain("post:other.py");
      expect(iniCall?.[1]).toContain("pre:cnext_build.py");
    });

    it("skips modification when already configured", () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(
        "[env:esp32]\nextra_scripts = pre:cnext_build.py\n",
      );

      PlatformIOCommand.install();

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("already configured"),
      );
    });

    it("outputs success message with next steps", () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue("[env:esp32]\n");

      PlatformIOCommand.install();

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("PlatformIO integration configured"),
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("Next steps"),
      );
    });
  });

  describe("uninstall", () => {
    it("fails when platformio.ini doesn't exist", () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      expect(() => PlatformIOCommand.uninstall()).toThrow("process.exit(1)");

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Error: platformio.ini not found in current directory",
      );
    });

    it("removes cnext_build.py when it exists", () => {
      vi.mocked(fs.existsSync).mockImplementation((path) => {
        if ((path as string).includes("platformio.ini")) return true;
        if ((path as string).includes("cnext_build.py")) return true;
        return false;
      });
      vi.mocked(fs.readFileSync).mockReturnValue("[env:esp32]\n");

      PlatformIOCommand.uninstall();

      expect(fs.unlinkSync).toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("Removed"),
      );
    });

    it("reports when cnext_build.py doesn't exist", () => {
      vi.mocked(fs.existsSync).mockImplementation((path) => {
        if ((path as string).includes("platformio.ini")) return true;
        return false; // cnext_build.py doesn't exist
      });
      vi.mocked(fs.readFileSync).mockReturnValue("[env:esp32]\n");

      PlatformIOCommand.uninstall();

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("already removed"),
      );
    });

    it("removes cnext_build.py reference from platformio.ini", () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(
        "[env:esp32]\nextra_scripts = pre:cnext_build.py\n",
      );

      PlatformIOCommand.uninstall();

      const writeCalls = vi.mocked(fs.writeFileSync).mock.calls;
      const iniCall = writeCalls.find((call) =>
        (call[0] as string).includes("platformio.ini"),
      );

      expect(iniCall).toBeDefined();
      expect(iniCall?.[1]).not.toContain("cnext_build.py");
    });

    it("reports when no integration found", () => {
      vi.mocked(fs.existsSync).mockImplementation((path) => {
        if ((path as string).includes("platformio.ini")) return true;
        return false;
      });
      vi.mocked(fs.readFileSync).mockReturnValue("[env:esp32]\n");

      PlatformIOCommand.uninstall();

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("No c-next integration found"),
      );
    });

    it("handles file deletion errors", () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue("[env:esp32]\n");
      vi.mocked(fs.unlinkSync).mockImplementation(() => {
        throw new Error("Permission denied");
      });

      expect(() => PlatformIOCommand.uninstall()).toThrow("process.exit(1)");

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Error removing"),
        expect.anything(),
      );
    });

    it("outputs success message after removal", () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(
        "[env:esp32]\nextra_scripts = pre:cnext_build.py\n",
      );
      vi.mocked(fs.unlinkSync).mockImplementation(() => {});

      PlatformIOCommand.uninstall();

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("integration removed"),
      );
    });
  });
});
