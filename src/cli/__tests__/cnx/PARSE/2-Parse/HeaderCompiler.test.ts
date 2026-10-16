/**
 * #1713, owner ruling 2026-10-16: a run's headers are read by its target's
 * own compiler, read from the real catalog rows.
 */
import { describe, expect, it } from "vitest";
import HeaderCompiler from "../../../../../cnx/PARSE/2-Parse/HeaderCompiler";
import TargetResolver from "../../../../TargetResolver";
import type ITargetDescription from "../../../../../cnx/types/ITargetDescription";
import NodeFileSystem from "../../../../../cnx/PARSE/1-Discover/NodeFileSystem";

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

  it.each([
    ["atmega328p", "avr-gcc"],
    ["host", "gcc"],
    ["cortex-m7", "arm-none-eabi-gcc"],
  ])(
    "a compiler the project names does not override %s's own (%s)",
    (name, driver) => {
      const compiler = HeaderCompiler.of(row(name), "/opt/x/arm-none-eabi-gcc");
      expect(compiler).toMatchObject({ driver });
    },
  );

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
