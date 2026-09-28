/**
 * How GCC compiles for one target (#1668's target matrix; #1713 reads it too).
 *
 * Derived from a target description's `toolchain_triple` and `toolchain_cpu`
 * by `TargetToolchain.gccFor`, the one place that knows which GCC driver
 * builds for which architecture.
 */
interface IGccToolchain {
  /**
   * Prepended to `gcc` or `g++`: `arm-none-eabi-` or `avr-`, and "" for the
   * build machine's own compiler
   */
  readonly driverPrefix: string;
  /** Flags selecting the architecture and part: `-mthumb -mcpu=cortex-m4` */
  readonly archFlags: readonly string[];
  /**
   * Whether generated code for this architecture calls the CMSIS-Core
   * intrinsics (`cmsis_gcc.h`), which no C library ships
   */
  readonly cmsisCore: boolean;
}

export default IGccToolchain;
