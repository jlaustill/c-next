import TargetToolchain from "../../utils/TargetToolchain";
import type ITargetDescription from "../../types/ITargetDescription";
import type IHeaderCompiler from "./preprocessor/types/IHeaderCompiler";

class HeaderCompiler {
  /**
   * #1713, owner ruling 2026-10-16: a run's headers are read by its target's
   * own compiler, chosen by the rule the target matrix compiles by
   * (`TargetToolchain`): `gcc` for `host`, `avr-gcc` for AVR,
   * `arm-none-eabi-gcc` for Cortex-M. A compiler the project names
   * (`configured`) reads them only for a target that names none; otherwise,
   * why there is no compiler.
   */
  static of(
    description: ITargetDescription,
    configured: string | null,
  ): IHeaderCompiler | string {
    const gcc = TargetToolchain.gccFor(description);
    if (typeof gcc !== "string") {
      return { driver: `${gcc.driverPrefix}gcc`, flags: gcc.archFlags };
    }
    return configured === null ? gcc : { driver: configured, flags: [] };
  }

  /**
   * Who read a run's headers, as a cache names it: what one compiler declares
   * for a header another may not (`uintptr_t` is 64-bit for `gcc`, 32-bit for
   * `arm-none-eabi-gcc -mcpu=cortex-m7`). `null`: the text was read as written.
   */
  static identity(compiler: IHeaderCompiler | null): string {
    return compiler === null
      ? "unpreprocessed"
      : [compiler.driver, ...compiler.flags].join(" ");
  }
}

export default HeaderCompiler;
