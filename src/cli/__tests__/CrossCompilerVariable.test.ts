/**
 * #2166: `CNX_CROSS_COMPILER` names the compiler a run reads its headers with,
 * and every diagnostic that asks for one names it. `CNEXT_CROSS_COMPILER` is
 * E0924, and the run reads no header.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import Transpiler from "../Transpiler";
import Preprocessor from "../../cnx/PARSE/2-Parse/preprocessor/Preprocessor";
import NodeFileSystem from "../../cnx/PARSE/1-Discover/NodeFileSystem";

/** A compiler that builds for a 64-bit host, as its `-dM` dump says */
const LP64_DUMP = [
  "#define __CHAR_BIT__ 8",
  "#define __SIZEOF_POINTER__ 8",
  "#define __SIZEOF_INT__ 4",
  "#define __SIZEOF_LONG__ 8",
  "#define __SIZEOF_LONG_LONG__ 8",
  "#define __BYTE_ORDER__ __ORDER_LITTLE_ENDIAN__",
].join("\n");

describe("CNX_CROSS_COMPILER (#2166)", () => {
  let dir: string;
  const exported = {
    CNX_CROSS_COMPILER: process.env.CNX_CROSS_COMPILER,
    CNEXT_CROSS_COMPILER: process.env.CNEXT_CROSS_COMPILER,
  };

  beforeEach(() => {
    delete process.env.CNX_CROSS_COMPILER;
    delete process.env.CNEXT_CROSS_COMPILER;
    dir = mkdtempSync(join(tmpdir(), "cnx-2166-"));
    writeFileSync(join(dir, "board.h"), "#define LED 13\n");
    writeFileSync(
      join(dir, "main.cnx"),
      '#include "board.h"\n\nvoid main() { }\n',
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    rmSync(dir, { recursive: true, force: true });
    for (const [name, value] of Object.entries(exported)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  });

  function transpile(target: string) {
    return new Transpiler(
      {
        input: join(dir, "main.cnx"),
        includeDirs: [dir],
        outDir: join(dir, "out"),
        noCache: true,
        target,
      },
      NodeFileSystem.instance,
    ).transpile({ kind: "files" });
  }

  it("asks for it when the target names no compiler (E0516)", async () => {
    const result = await transpile("esp32");

    expect(result.errors.map((e) => [e.message, e.helpText])).toEqual([
      [
        "error[E0516]: this run includes C headers, and no C preprocessor was found to read them",
        "target 'esp32' names no toolchain. Set CNX_CROSS_COMPILER to the compiler for the target's headers.",
      ],
    ]);
  });

  it("reads the headers with the compiler it names, and names it when that compiler builds for another target (E0517)", async () => {
    process.env.CNX_CROSS_COMPILER = "x86_64-linux-gnu-gcc";
    vi.spyOn(Preprocessor.prototype, "isAvailable").mockReturnValue(true);
    vi.spyOn(Preprocessor.prototype, "preprocessString").mockResolvedValue({
      content: LP64_DUMP,
      sourceMappings: [],
      success: true,
      originalFile: "data-model.c",
    });

    const result = await transpile("atmega328p");

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toBe(
      "error[E0517]: this run names the compiler 'x86_64-linux-gnu-gcc', which builds for a different platform than target 'atmega328p'",
    );
    expect(result.errors[0].helpText).toMatch(
      /^target 'atmega328p' has .*\. Set CNX_CROSS_COMPILER \(or compile_commands\.json\) to a compiler for 'atmega328p', or remove it to use the target's own\.$/,
    );
  });

  it("rejects CNEXT_CROSS_COMPILER before any header is read (E0924)", async () => {
    process.env.CNEXT_CROSS_COMPILER = "xtensa-esp32-elf-gcc";
    const preprocess = vi.spyOn(Preprocessor.prototype, "preprocessString");

    const result = await transpile("esp32");

    expect(result.success).toBe(false);
    expect(
      result.errors.map((e) => [e.sourcePath, e.line, e.message, e.helpText]),
    ).toEqual([
      [
        join(dir, "main.cnx"),
        1,
        "error[E0924]: the environment sets CNEXT_CROSS_COMPILER, which cnx no longer reads: it is now CNX_CROSS_COMPILER",
        "Set CNX_CROSS_COMPILER to 'xtensa-esp32-elf-gcc' instead, and unset CNEXT_CROSS_COMPILER.",
      ],
    ]);
    expect(preprocess).not.toHaveBeenCalled();
  });
});
