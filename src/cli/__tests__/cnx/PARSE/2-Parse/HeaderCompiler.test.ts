/**
 * #1713: a run's headers are read by its target's own compiler, or by one the
 * project names that builds for the target (#1542 ruling 10), read from the
 * real catalog rows.
 */
import { describe, expect, it } from "vitest";
import HeaderCompiler from "../../../../../cnx/PARSE/2-Parse/HeaderCompiler";
import TargetResolver from "../../../../TargetResolver";
import type ITargetDescription from "../../../../../cnx/types/ITargetDescription";
import NodeFileSystem from "../../../../../cnx/PARSE/1-Discover/NodeFileSystem";
import type IHeaderPreprocessor from "../../../../../cnx/PARSE/2-Parse/preprocessor/types/IHeaderPreprocessor";

function row(name: string): ITargetDescription {
  const description = TargetResolver.byName(name, NodeFileSystem.instance);
  expect(description).toBeDefined();
  return description!;
}

describe("HeaderCompiler.of", () => {
  it.each([
    ["host", "gcc", []],
    ["atmega328p", "avr-gcc", ["-mmcu=atmega328p"]],
    ["cortex-m7", "arm-none-eabi-gcc", ["-mthumb", "-mcpu=cortex-m7"]],
  ])("reads %s's headers with %s", (name, driver, flags) => {
    expect(HeaderCompiler.of(row(name), null)).toEqual({ driver, flags });
  });

  it("a compiler the project names reads the headers, with the target's flags", () => {
    expect(
      HeaderCompiler.of(row("cortex-m7"), "/opt/x/arm-none-eabi-gcc"),
    ).toEqual({
      driver: "/opt/x/arm-none-eabi-gcc",
      flags: ["-mthumb", "-mcpu=cortex-m7"],
    });
  });

  it("a target that names no toolchain uses the project's compiler", () => {
    const esp32 = { ...row("cortex-m7"), name: "esp32" };
    const bare: ITargetDescription = {
      ...esp32,
      toolchain_triple: undefined,
      toolchain_cpu: undefined,
    };
    expect(HeaderCompiler.of(bare, "xtensa-esp32-elf-gcc")).toEqual({
      driver: "xtensa-esp32-elf-gcc",
      flags: [],
    });
    expect(typeof HeaderCompiler.of(bare, null)).toBe("string");
  });
});

/** A compiler whose `-dM` dump of an empty file is `macros` */
function compilerDefining(macros: Record<string, string>): IHeaderPreprocessor {
  const dump = Object.entries(macros)
    .map(([name, value]) => `#define ${name} ${value}`)
    .join("\n");
  return {
    isAvailable: () => true,
    preprocess: () => Promise.reject(new Error("not used")),
    preprocessString: () =>
      Promise.resolve({
        content: dump,
        sourceMappings: [],
        success: true,
        originalFile: "data-model.c",
      }),
  };
}

const LP64 = {
  __CHAR_BIT__: "8",
  __SIZEOF_POINTER__: "8",
  __SIZEOF_INT__: "4",
  __SIZEOF_LONG__: "8",
  __SIZEOF_LONG_LONG__: "8",
  __BYTE_ORDER__: "__ORDER_LITTLE_ENDIAN__",
};
const AVR = {
  ...LP64,
  __SIZEOF_POINTER__: "2",
  __SIZEOF_INT__: "2",
  __SIZEOF_LONG__: "4",
};

describe("HeaderCompiler.disagreement (#1542 ruling 10)", () => {
  it("accepts a compiler that builds for the target's data model", async () => {
    expect(
      await HeaderCompiler.disagreement(compilerDefining(LP64), row("host")),
    ).toBeNull();
    expect(
      await HeaderCompiler.disagreement(
        compilerDefining(AVR),
        row("atmega328p"),
      ),
    ).toBeNull();
  });

  it("names the first width that differs", async () => {
    expect(
      await HeaderCompiler.disagreement(compilerDefining(AVR), row("host")),
    ).toBe(
      "target 'host' has 64-bit pointers, and this compiler's __SIZEOF_POINTER__ gives 16-bit",
    );
    expect(
      await HeaderCompiler.disagreement(
        compilerDefining({ ...LP64, __SIZEOF_LONG__: "4" }),
        row("host"),
      ),
    ).toBe(
      "target 'host' has 64-bit long, and this compiler's __SIZEOF_LONG__ gives 32-bit",
    );
  });

  it("rejects a compiler of the other byte order", async () => {
    expect(
      await HeaderCompiler.disagreement(
        compilerDefining({ ...LP64, __BYTE_ORDER__: "__ORDER_BIG_ENDIAN__" }),
        row("host"),
      ),
    ).toBe("target 'host' is little-endian, and this compiler is not");
  });

  it("reports a compiler that cannot be run", async () => {
    const broken: IHeaderPreprocessor = {
      ...compilerDefining({}),
      preprocessString: () =>
        Promise.resolve({
          content: "",
          sourceMappings: [],
          success: false,
          error: "avr-gcc: error: unrecognized option '-mthumb'",
          originalFile: "data-model.c",
        }),
    };
    expect(await HeaderCompiler.disagreement(broken, row("host"))).toBe(
      "avr-gcc: error: unrecognized option '-mthumb'",
    );
  });
});
