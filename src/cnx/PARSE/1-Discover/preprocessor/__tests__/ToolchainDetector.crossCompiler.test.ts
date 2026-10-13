/**
 * Unit tests for ToolchainDetector.fromPath and the CNEXT_CROSS_COMPILER override.
 *
 * Cross-compilation targets (e.g. ESP32/xtensa) ship framework headers that
 * only preprocess with the target compiler — host gcc lacks their system
 * headers and predefined macros. CNEXT_CROSS_COMPILER lets a project point cnext's
 * preprocessor at that compiler (e.g. xtensa-esp32s3-elf-gcc).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import ToolchainDetector from "../ToolchainDetector";

vi.mock("node:child_process", () => ({ execFileSync: vi.fn() }));
vi.mock("node:fs", () => ({ existsSync: vi.fn() }));

import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import NodeFileSystem from "../../NodeFileSystem";

/**
 * Answer the mocked `execFileSync` by the command it would run, written as one
 * string (`which gcc`, `/usr/bin/gcc --version`) so a case reads as the
 * invocation it stubs.
 */
function whenRun(answer: (command: string) => string): void {
  vi.mocked(execFileSync).mockImplementation(((
    file: string,
    args?: readonly string[],
  ) => answer([file, ...(args ?? [])].join(" "))) as typeof execFileSync);
}

describe("ToolchainDetector.fromPath", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it("builds a cross-compiler toolchain from an executable name on PATH", () => {
    whenRun((cmd) => {
      if (cmd === "which xtensa-esp32s3-elf-gcc") {
        return "/opt/xt/bin/xtensa-esp32s3-elf-gcc\n";
      }
      return "xtensa-esp32s3-elf-gcc (crosstool-NG) 12.2.0\n";
    });
    vi.mocked(existsSync).mockReturnValue(true);

    const tc = ToolchainDetector.fromPath(
      "xtensa-esp32s3-elf-gcc",
      NodeFileSystem.instance,
    );

    expect(tc).not.toBeNull();
    expect(tc!.cpp).toBe("/opt/xt/bin/xtensa-esp32s3-elf-gcc");
    expect(tc!.name).toBe("xtensa-esp32s3-elf-gcc");
    expect(tc!.isCrossCompiler).toBe(true);
  });

  it("accepts an absolute compiler path directly", () => {
    vi.mocked(existsSync).mockReturnValue(true);
    whenRun(() => "gcc 13\n");

    const tc = ToolchainDetector.fromPath(
      "/usr/bin/xtensa-esp32s3-elf-gcc",
      NodeFileSystem.instance,
    );

    expect(tc!.cpp).toBe("/usr/bin/xtensa-esp32s3-elf-gcc");
  });

  it("returns null when the compiler path does not exist", () => {
    vi.mocked(existsSync).mockReturnValue(false);

    expect(
      ToolchainDetector.fromPath("/nope/xtensa-gcc", NodeFileSystem.instance),
    ).toBeNull();
  });
});

describe("ToolchainDetector.detect with CNEXT_CROSS_COMPILER", () => {
  const original = process.env.CNEXT_CROSS_COMPILER;
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => {
    vi.restoreAllMocks();
    if (original === undefined) delete process.env.CNEXT_CROSS_COMPILER;
    else process.env.CNEXT_CROSS_COMPILER = original;
  });

  it("prefers CNEXT_CROSS_COMPILER over auto-detected toolchains", () => {
    process.env.CNEXT_CROSS_COMPILER = "/opt/xt/bin/xtensa-esp32s3-elf-gcc";
    vi.mocked(existsSync).mockReturnValue(true);
    whenRun(() => "xtensa gcc 12.2\n");

    const tc = ToolchainDetector.detect(NodeFileSystem.instance);

    expect(tc).not.toBeNull();
    expect(tc!.cpp).toBe("/opt/xt/bin/xtensa-esp32s3-elf-gcc");
    expect(tc!.isCrossCompiler).toBe(true);
  });
});
