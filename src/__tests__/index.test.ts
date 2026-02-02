/**
 * Unit tests for the CLI entry point (src/index.ts)
 *
 * Tests the main() function's orchestration of Cli and Runner.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Mock the modules before importing the code under test
vi.mock("../cli/Cli");
vi.mock("../cli/Runner");

// Import the main function (exported for testability)
import main from "../index";
import Cli from "../cli/Cli";
import Runner from "../cli/Runner";

describe("index.ts (CLI entry point)", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let processExitSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();

    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    processExitSpy = vi.spyOn(process, "exit").mockImplementation((code) => {
      throw new Error(`process.exit(${code})`);
    });
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    processExitSpy.mockRestore();
  });

  it("calls Cli.run() and exits with its exit code when shouldRun is false", async () => {
    vi.mocked(Cli.run).mockReturnValue({
      shouldRun: false,
      exitCode: 0,
    });

    await expect(main()).rejects.toThrow("process.exit(0)");

    expect(Cli.run).toHaveBeenCalled();
    expect(Runner.execute).not.toHaveBeenCalled();
  });

  it("calls Runner.execute when shouldRun is true", async () => {
    const mockConfig = {
      inputs: ["test.cnx"],
      outputPath: "",
      includeDirs: [],
      defines: {},
      preprocess: true,
      verbose: false,
      cppRequired: false,
      noCache: false,
      parseOnly: false,
    };

    vi.mocked(Cli.run).mockReturnValue({
      shouldRun: true,
      exitCode: 0,
      config: mockConfig,
    });
    vi.mocked(Runner.execute).mockResolvedValue(undefined);

    await expect(main()).rejects.toThrow("process.exit(0)");

    expect(Cli.run).toHaveBeenCalled();
    expect(Runner.execute).toHaveBeenCalledWith(mockConfig);
  });

  it("exits with error code 1 when Cli.run returns exitCode 1", async () => {
    vi.mocked(Cli.run).mockReturnValue({
      shouldRun: false,
      exitCode: 1,
    });

    await expect(main()).rejects.toThrow("process.exit(1)");
  });

  it("does not call Runner.execute when config is undefined", async () => {
    vi.mocked(Cli.run).mockReturnValue({
      shouldRun: true, // shouldRun is true but config is missing
      exitCode: 0,
      config: undefined,
    });

    await expect(main()).rejects.toThrow("process.exit(0)");

    expect(Runner.execute).not.toHaveBeenCalled();
  });
});
