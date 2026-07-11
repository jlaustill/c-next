/**
 * Unit tests for CompileCommandsReader.
 *
 * cnext must resolve external C/C++ headers exactly as the compiler will. Every
 * build system (CMake, PlatformIO, Meson, Zephyr, bear-wrapped Make) converges
 * on the same artifact — a `compile_commands.json` compilation database listing,
 * per translation unit, the compiler binary and its `-I` / `-D` flags. Reading
 * that database is how clangd/clang-tidy stay build-system-agnostic; cnext reads
 * it for the same reason. This is the pure parse layer (no filesystem): a DB
 * string in, `{ includePaths, defines, compiler }` out.
 */
import { describe, it, expect } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import CompileCommandsReader from "../CompileCommandsReader";

describe("CompileCommandsReader.parse", () => {
  it("extracts include paths from -I arguments, resolving relative to the entry directory", () => {
    const db = JSON.stringify([
      {
        directory: "/project/build",
        file: "/project/src/main.cpp",
        arguments: [
          "xtensa-esp32s3-elf-g++",
          "-I/abs/include",
          "-I../rel/include",
          "-c",
          "/project/src/main.cpp",
        ],
      },
    ]);

    const result = CompileCommandsReader.parse(db);

    // Absolute -I kept verbatim.
    expect(result.includePaths).toContain("/abs/include");
    // Relative -I resolved against the entry's `directory` (/project/build).
    expect(result.includePaths).toContain("/project/rel/include");
  });

  it("handles space-separated -I and -isystem forms", () => {
    const db = JSON.stringify([
      {
        directory: "/project",
        file: "/project/src/main.cpp",
        arguments: [
          "g++",
          "-I",
          "sep/include",
          "-isystem",
          "/opt/toolchain/include",
          "-isystem/attached/system",
          "-c",
          "main.cpp",
        ],
      },
    ]);

    const result = CompileCommandsReader.parse(db);

    expect(result.includePaths).toContain("/project/sep/include"); // -I <path>
    expect(result.includePaths).toContain("/opt/toolchain/include"); // -isystem <path>
    expect(result.includePaths).toContain("/attached/system"); // -isystem<path>
  });

  it("extracts defines: KEY=VAL, bare KEY, and space-separated forms", () => {
    const db = JSON.stringify([
      {
        directory: "/project",
        file: "/project/src/main.cpp",
        arguments: [
          "g++",
          "-DARDUINO=10812",
          "-DCORE_DEBUG_LEVEL",
          "-D",
          "F_CPU=240000000L",
          "-c",
          "main.cpp",
        ],
      },
    ]);

    const result = CompileCommandsReader.parse(db);

    expect(result.defines.ARDUINO).toBe("10812"); // -DKEY=VAL
    expect(result.defines.CORE_DEBUG_LEVEL).toBe(true); // bare -DKEY
    expect(result.defines.F_CPU).toBe("240000000L"); // -D KEY=VAL (separated)
  });

  it("parses the `command` string form with POSIX word-splitting", () => {
    // PlatformIO emits a `command` string (not `arguments`). Word-splitting must
    // match the shell the compiler was actually invoked through: real quotes are
    // syntax (consumed), backslash-escaped quotes are literal (kept), and spaces
    // inside quotes are preserved. The ARDUINO_BOARD case is the real gnarly one
    // — outer real quotes wrapping backslash-escaped inner quotes, with spaces.
    const db = JSON.stringify([
      {
        directory: "/project",
        file: "/project/src/main.cpp",
        command:
          "xtensa-esp32s3-elf-g++ -Iinclude -I/abs/inc -DARDUINO=10812 " +
          '-DARDUINO_BOARD="\\"Espressif ESP32-S3 (8 MB QD, No PSRAM)\\"" ' +
          "'-DSINGLE=a b' -c main.cpp",
      },
    ]);

    const result = CompileCommandsReader.parse(db);

    expect(result.compiler).toBe("xtensa-esp32s3-elf-g++"); // argv[0]
    expect(result.includePaths).toContain("/project/include"); // -Iinclude, rel
    expect(result.includePaths).toContain("/abs/inc");
    expect(result.defines.ARDUINO).toBe("10812");
    // Escaped inner quotes kept, spaces preserved inside the real outer quotes.
    expect(result.defines.ARDUINO_BOARD).toBe(
      '"Espressif ESP32-S3 (8 MB QD, No PSRAM)"',
    );
    // Single-quoted operand: literal, spaces preserved, quotes consumed.
    expect(result.defines.SINGLE).toBe("a b");
  });

  it("matches shlex on double-quote escapes and escaped whitespace", () => {
    // Verified against `shlex.split`: inside "" only \" and \\ are escapes, so a
    // backslash is KEPT before other characters (e.g. $); \<space> outside quotes
    // is a literal space that joins one token.
    const command = String.raw`cc -DA="x\\y" -DB="p\$q" -DD="lit\z" -DE=v\ w -c f.c`;
    const db = JSON.stringify([{ directory: "/p", file: "/p/f.c", command }]);

    const result = CompileCommandsReader.parse(db);

    expect(result.defines.A).toBe("x\\y"); // "\\" -> one literal backslash
    expect(result.defines.B).toBe("p\\$q"); // "\$" -> backslash kept
    expect(result.defines.D).toBe("lit\\z"); // "\z" -> backslash kept
    expect(result.defines.E).toBe("v w"); // v\ w -> single token "v w"
  });

  it("ignores trailing -I / -D flags that have no operand", () => {
    const dbI = JSON.stringify([
      { directory: "/p", file: "a.c", arguments: ["cc", "-I"] },
    ]);
    const dbD = JSON.stringify([
      { directory: "/p", file: "a.c", arguments: ["cc", "-D"] },
    ]);

    expect(CompileCommandsReader.parse(dbI).includePaths).toEqual([]);
    expect(CompileCommandsReader.parse(dbD).defines).toEqual({});
  });

  it("drops a trailing backslash without crashing", () => {
    const db = JSON.stringify([
      { directory: "/p", file: "/p/f.c", command: "cc -DA=1 -c f.c\\" },
    ]);

    const result = CompileCommandsReader.parse(db);

    expect(result.defines.A).toBe("1");
    expect(result.compiler).toBe("cc");
  });

  it("tolerates an entry with neither command nor arguments", () => {
    const db = JSON.stringify([{ directory: "/p", file: "/p/a.c" }]);

    const result = CompileCommandsReader.parse(db);

    expect(result.includePaths).toEqual([]);
    expect(result.defines).toEqual({});
    expect(result.compiler).toBeNull();
  });
});

describe("CompileCommandsReader.load", () => {
  it("reads and parses a compile_commands.json file from disk", () => {
    const dir = mkdtempSync(join(tmpdir(), "cnext-cc-"));
    try {
      writeFileSync(
        join(dir, "compile_commands.json"),
        JSON.stringify([
          {
            directory: dir,
            file: "a.cpp",
            command: "g++ -I/x/inc -DFOO=1 -c a.cpp",
          },
        ]),
      );

      const result = CompileCommandsReader.load(
        join(dir, "compile_commands.json"),
      );

      expect(result).not.toBeNull();
      expect(result?.includePaths).toContain("/x/inc");
      expect(result?.defines.FOO).toBe("1");
      expect(result?.compiler).toBe("g++");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("returns null for a missing file (caller falls back to config)", () => {
    expect(
      CompileCommandsReader.load("/no/such/dir/compile_commands.json"),
    ).toBeNull();
  });

  it("returns null for malformed JSON rather than throwing", () => {
    const dir = mkdtempSync(join(tmpdir(), "cnext-cc-"));
    try {
      writeFileSync(join(dir, "compile_commands.json"), "{ not valid json ");
      expect(
        CompileCommandsReader.load(join(dir, "compile_commands.json")),
      ).toBeNull();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
