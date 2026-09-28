/**
 * Which GCC compiles for a target (#1668's target matrix).
 *
 * The target catalog names an architecture with an LLVM-style
 * `toolchain_triple` and a part with `toolchain_cpu`. This is the one place
 * that turns those into a GCC driver and its flags. The owner ruled on
 * 2026-09-27 that the GCC family is supported first; other compilers are
 * #1761. #1713 (preprocessing C headers for the program's target) is to read
 * the same answer, so header preprocessing and the matrix's compile checks
 * choose a compiler by one rule.
 *
 * The `host` row is the build machine (owner ruling, 2026-09-26), so it is
 * compiled by the machine's own `gcc`, whatever triple the row records.
 */

import type IGccToolchain from "../transpiler/types/IGccToolchain";
import type ITargetDescription from "../transpiler/types/ITargetDescription";

/** The build machine's row in the target catalog */
const HOST = "host";

/** A Cortex-M triple: `thumbv7em-none-eabi`, `thumbv6m-none-eabi`, ... */
const CORTEX_M_TRIPLE = /^thumbv\d+[a-z]*-none-eabi$/;

class TargetToolchain {
  /**
   * The GCC toolchain for a target, or why there is none: the description
   * names no toolchain (an `esp32` row), or names an architecture no GCC
   * driver here covers. An inline description never names one (E0512); the
   * target matrix compiles it with the toolchain of the catalog row that
   * shares its platform facts.
   */
  static gccFor(description: ITargetDescription): IGccToolchain | string {
    if (description.name === HOST) {
      return { driverPrefix: "", archFlags: [], cmsisCore: false };
    }
    const triple = description.toolchain_triple;
    const cpu = description.toolchain_cpu;
    if (triple === undefined || cpu === undefined) {
      return `target '${description.name}' names no toolchain`;
    }
    if (CORTEX_M_TRIPLE.test(triple)) {
      return {
        driverPrefix: "arm-none-eabi-",
        archFlags: ["-mthumb", `-mcpu=${cpu}`],
        cmsisCore: true,
      };
    }
    if (triple === "avr") {
      return {
        driverPrefix: "avr-",
        archFlags: [`-mmcu=${cpu}`],
        cmsisCore: false,
      };
    }
    return `no GCC toolchain for '${triple}' (target '${description.name}'; see #1761)`;
  }
}

export default TargetToolchain;
