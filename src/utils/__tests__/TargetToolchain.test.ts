/**
 * #1668 (T4): which GCC compiles for a target, read from the real catalog
 * rows, so a catalog change that moves a row's toolchain shows up here.
 */
import { describe, expect, it } from "vitest";
import TargetToolchain from "../TargetToolchain";
import TargetResolver from "../TargetResolver";
import type ITargetDescription from "../../types/ITargetDescription";
import NodeFileSystem from "../../PARSE/1-Discover/NodeFileSystem";

function row(name: string): ITargetDescription {
  const description = TargetResolver.byName(name, NodeFileSystem.instance);
  expect(description).toBeDefined();
  return description!;
}

describe("TargetToolchain.gccFor", () => {
  it.each([
    ["cortex-m4", ["-mthumb", "-mcpu=cortex-m4"]],
    ["cortex-m7", ["-mthumb", "-mcpu=cortex-m7"]],
    ["cortex-m0+", ["-mthumb", "-mcpu=cortex-m0plus"]],
    ["teensy41", ["-mthumb", "-mcpu=cortex-m7"]],
  ])(
    "compiles %s with the ARM cross GCC and the CMSIS intrinsics",
    (name, archFlags) => {
      expect(TargetToolchain.gccFor(row(name))).toEqual({
        driverPrefix: "arm-none-eabi-",
        archFlags,
        cmsisCore: true,
      });
    },
  );

  it.each(["atmega328p", "avr", "arduino-uno"])(
    "compiles %s with avr-gcc for the ATmega328P",
    (name) => {
      expect(TargetToolchain.gccFor(row(name))).toEqual({
        driverPrefix: "avr-",
        archFlags: ["-mmcu=atmega328p"],
        cmsisCore: false,
      });
    },
  );

  it("compiles the host with the build machine's own gcc", () => {
    expect(TargetToolchain.gccFor(row("host"))).toEqual({
      driverPrefix: "",
      archFlags: [],
      cmsisCore: false,
    });
  });

  it("says why a row that names no toolchain has none", () => {
    expect(TargetToolchain.gccFor(row("esp32"))).toBe(
      "target 'esp32' names no toolchain",
    );
  });

  it("says why an architecture with no GCC driver here has none", () => {
    const riscv: ITargetDescription = {
      ...row("cortex-m4"),
      name: "riscv-part",
      toolchain_triple: "riscv32-unknown-elf",
      toolchain_cpu: "rv32imac",
    };
    expect(TargetToolchain.gccFor(riscv)).toBe(
      "no GCC toolchain for 'riscv32-unknown-elf' (target 'riscv-part'; see #1761)",
    );
  });
});
