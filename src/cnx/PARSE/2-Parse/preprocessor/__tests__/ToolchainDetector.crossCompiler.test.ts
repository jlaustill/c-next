/**
 * Unit tests for ToolchainDetector.fromPath, which finds the compiler CNX_CROSS_COMPILER names.
 *
 * Cross-compilation targets (e.g. ESP32/xtensa) ship framework headers that
 * only preprocess with the target compiler — host gcc lacks their system
 * headers and predefined macros. CNX_CROSS_COMPILER lets a project point cnx's
 * preprocessor at that compiler (e.g. xtensa-esp32s3-elf-gcc).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ToolchainDetector from "../ToolchainDetector";

vi.mock("node:child_process", () => ({ execFileSync: vi.fn() }));

import { execFileSync } from "node:child_process";
import NodeFileSystem from "../../../1-Discover/NodeFileSystem";
import TestFileSystem from "../../../../types/__testUtils__/TestFileSystem";

const installed = TestFileSystem.installedExecutables;

describe("ToolchainDetector.fromPath", () => {
  const originalPath = process.env.PATH;
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => {
    vi.restoreAllMocks();
    process.env.PATH = originalPath;
  });

  it("builds a cross-compiler toolchain from an executable name on PATH", () => {
    process.env.PATH = "/opt/xt/bin";
    vi.mocked(execFileSync).mockReturnValue(
      "xtensa-esp32s3-elf-gcc (crosstool-NG) 12.2.0\n",
    );

    const tc = ToolchainDetector.fromPath(
      "xtensa-esp32s3-elf-gcc",
      installed("/opt/xt/bin/xtensa-esp32s3-elf-gcc"),
    );

    expect(tc).not.toBeNull();
    expect(tc!.cpp).toBe("/opt/xt/bin/xtensa-esp32s3-elf-gcc");
    expect(tc!.name).toBe("xtensa-esp32s3-elf-gcc");
    expect(tc!.isCrossCompiler).toBe(true);
  });

  it("accepts an absolute compiler path directly", () => {
    vi.mocked(execFileSync).mockReturnValue("gcc 13\n");

    const tc = ToolchainDetector.fromPath(
      "/usr/bin/xtensa-esp32s3-elf-gcc",
      installed("/usr/bin/xtensa-esp32s3-elf-gcc"),
    );

    expect(tc!.cpp).toBe("/usr/bin/xtensa-esp32s3-elf-gcc");
  });

  it("returns null when the compiler path does not exist", () => {
    expect(
      ToolchainDetector.fromPath("/nope/xtensa-gcc", installed()),
    ).toBeNull();
  });
});

// The real filesystem: a path resolves only to a file this process may run,
// the same test a PATH name passes. The double above cannot tell "exists" from
// "executable", so these cases need real permissions.
describe("ToolchainDetector.fromPath on the real filesystem", () => {
  let dir: string;
  beforeEach(() => {
    vi.clearAllMocks();
    dir = mkdtempSync(join(tmpdir(), "cnx-from-path-"));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it.skipIf(process.platform === "win32")(
    "returns null for a file without execute permission",
    () => {
      const path = join(dir, "plain-file");
      writeFileSync(path, "");
      chmodSync(path, 0o644);

      expect(
        ToolchainDetector.fromPath(path, NodeFileSystem.instance),
      ).toBeNull();
    },
  );

  it("returns null for a directory", () => {
    const path = join(dir, "bin");
    mkdirSync(path);

    expect(
      ToolchainDetector.fromPath(`${path}/`, NodeFileSystem.instance),
    ).toBeNull();
  });

  it("takes the g++ beside gcc only when it may run", () => {
    vi.mocked(execFileSync).mockReturnValue("gcc 13\n");
    const gcc = join(dir, "x-gcc");
    const gxx = join(dir, "x-g++");
    writeFileSync(gcc, "");
    chmodSync(gcc, 0o755);
    writeFileSync(gxx, "");
    chmodSync(gxx, 0o644);

    expect(ToolchainDetector.fromPath(gcc, NodeFileSystem.instance)!.cxx).toBe(
      gcc,
    );

    chmodSync(gxx, 0o755);
    expect(ToolchainDetector.fromPath(gcc, NodeFileSystem.instance)!.cxx).toBe(
      gxx,
    );
  });
});
