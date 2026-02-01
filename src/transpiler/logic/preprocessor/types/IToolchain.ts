/**
 * Represents a detected C/C++ toolchain
 */
interface IToolchain {
  /** Name of the toolchain (e.g., "gcc", "clang", "arm-none-eabi-gcc") */
  name: string;

  /** Path to the C compiler */
  cc: string;

  /** Path to the C++ compiler */
  cxx: string;

  /** Path to the preprocessor (usually same as cc with -E flag) */
  cpp: string;

  /** Toolchain version string */
  version?: string;

  /** Whether this is a cross-compiler (e.g., for ARM) */
  isCrossCompiler: boolean;

  /** Target triple if cross-compiling (e.g., "arm-none-eabi") */
  target?: string;
}

export default IToolchain;
