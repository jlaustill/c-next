import type IToolchainRequirement from "../types/IToolchainRequirement";
import type TRequirementKey from "../types/TRequirementKey";

/**
 * Issue #1143: The single source of truth for what generated output costs.
 *
 * Every construct the code generator emits whose acceptance depends on the
 * toolchain has an entry here, and the emitting code records that entry's key
 * at the moment it produces the text. The transpile-time report, the per-file
 * banner, docs/compatibility.md, the MISRA guideline rows and any compile-time
 * guard are all projections of this table -- none of them re-derives the
 * answer, so none of them can contradict what was emitted.
 *
 * Requirements are CONDITIONAL. A file that uses no critical section pays no
 * CMSIS cost; a file that does not index bits of a float pays no C11 cost. The
 * flat claim "generated code is standard C99" was false in both directions: it
 * overstated what plain files need and understated what these files need.
 *
 * Note there is currently no compiler-version floor anywhere in this table.
 * The only one that ever existed came from the unreachable
 * __builtin_*_overflow calls removed in #1143.
 */
const TOOLCHAIN_REQUIREMENTS: Record<TRequirementKey, IToolchainRequirement> = {
  "baseline-c": {
    key: "baseline-c",
    modes: ["c"],
    feature: "baseline",
    standard: "C99",
    compiler: null,
    extensions: [],
    platformLib: null,
    condition: null,
    reason: "<stdint.h> fixed-width types, // comments, mixed declarations",
    incurredBy: "any C-Next file transpiled to C",
    probe: null,
    adr: "ADR-044",
    misra: ["1.1"],
  },

  "baseline-cpp": {
    key: "baseline-cpp",
    modes: ["cpp"],
    feature: "baseline",
    standard: "C++11",
    compiler: null,
    extensions: [],
    platformLib: null,
    condition: null,
    reason: "nullptr, static_cast, reinterpret_cast",
    incurredBy: "any C-Next file transpiled with --cpp",
    probe: null,
    adr: "ADR-010",
    misra: ["1.1"],
  },

  "float-assert-c11": {
    key: "float-assert-c11",
    modes: ["c"],
    feature: "float bit indexing",
    standard: "C11",
    compiler: null,
    extensions: [],
    platformLib: null,
    condition: null,
    reason: "_Static_assert",
    incurredBy: "reading or writing a bit range of an f32 or f64",
    probe: /_Static_assert\(sizeof\((?:float|double)\)/,
    adr: "ADR-007",
    misra: ["1.1"],
  },

  "float-assert-cpp11": {
    key: "float-assert-cpp11",
    modes: ["cpp"],
    feature: "float bit indexing",
    standard: "C++11",
    compiler: null,
    extensions: [],
    platformLib: null,
    condition: null,
    reason: "static_assert",
    incurredBy: "reading or writing a bit range of an f32 or f64 with --cpp",
    probe: /static_assert\(sizeof\((?:float|double)\)/,
    adr: "ADR-007",
    misra: [],
  },

  "critical-arm-gnu": {
    key: "critical-arm-gnu",
    modes: ["c", "cpp"],
    feature: "critical section",
    standard: "C99",
    compiler: null,
    extensions: ["GNU inline assembly", "__attribute__((always_inline))"],
    platformLib: "ARMv7-M core",
    condition: "defined(__arm__) || defined(__ARM_ARCH)",
    reason:
      '__asm volatile ("MRS %0, primask"), __attribute__((always_inline))',
    incurredBy: "a critical block",
    probe: /MRS %0, primask/,
    adr: "ADR-050",
    misra: ["1.2", "Dir 4.3", "20.8", "20.9", "20.14"],
  },

  "critical-arduino": {
    key: "critical-arduino",
    modes: ["c", "cpp"],
    feature: "critical section",
    standard: "C99",
    compiler: null,
    extensions: [],
    platformLib: "Arduino core",
    condition: "defined(__arm__) && defined(ARDUINO)",
    reason: "noInterrupts()",
    incurredBy: "a critical block",
    probe: /noInterrupts\(\)/,
    adr: "ADR-050",
    misra: ["Dir 4.9", "20.8", "20.9", "20.14"],
  },

  "critical-avr-libc": {
    key: "critical-avr-libc",
    modes: ["c", "cpp"],
    feature: "critical section",
    standard: "C99",
    compiler: null,
    // Issue #1147: neither <avr/io.h> nor <avr/interrupt.h> is emitted, so
    // this arm does not currently compile standalone.
    platformLib: "avr-libc",
    extensions: [],
    condition: "defined(__AVR__)",
    reason: "SREG, cli()",
    incurredBy: "a critical block",
    probe: /return SREG;/,
    adr: "ADR-050",
    misra: ["Dir 4.9", "20.8", "20.9", "20.14"],
  },

  "critical-cmsis-fallback": {
    key: "critical-cmsis-fallback",
    modes: ["c", "cpp"],
    feature: "critical section",
    standard: "C99",
    compiler: null,
    extensions: [],
    // Issue #1147: no <cmsis_gcc.h> is emitted on this arm either.
    platformLib: "CMSIS",
    condition: "neither ARM nor AVR",
    reason: "__disable_irq(), __get_PRIMASK(), __set_PRIMASK()",
    incurredBy: "a critical block",
    probe: /\{ __disable_irq\(\); \}/,
    adr: "ADR-050",
    misra: ["Dir 4.9", "20.8", "20.9", "20.14"],
  },

  "atomic-ldrex-cmsis": {
    key: "atomic-ldrex-cmsis",
    modes: ["c", "cpp"],
    feature: "atomic read-modify-write",
    standard: "C99",
    compiler: null,
    extensions: [],
    platformLib: "CMSIS + ARMv7-M",
    condition: null,
    reason: "__LDREXB/H/W, __STREXB/H/W",
    incurredBy:
      "compound assignment to an atomic variable on a target with LDREX/STREX",
    probe: /__(?:LDREX|STREX)[BHW]\b/,
    adr: "ADR-049",
    misra: ["Dir 4.9"],
  },

  "atomic-primask-cmsis": {
    key: "atomic-primask-cmsis",
    modes: ["c", "cpp"],
    feature: "atomic read-modify-write",
    standard: "C99",
    compiler: null,
    extensions: [],
    platformLib: "CMSIS",
    // Issue #1146: unlike the critical-section arms, this path emits raw CMSIS
    // names with no #if guard, so it is unconditional rather than per-target.
    condition: null,
    reason: "__get_PRIMASK(), __disable_irq(), __set_PRIMASK()",
    incurredBy:
      "compound assignment to an atomic variable on a target without LDREX/STREX",
    probe: /uint32_t __primask = __get_PRIMASK\(\);/,
    adr: "ADR-049",
    misra: ["Dir 4.9"],
  },

  "cpp-designated-initializer": {
    key: "cpp-designated-initializer",
    modes: ["cpp"],
    feature: "struct initializer",
    standard: "C++20",
    compiler: null,
    // Accepted by GCC and Clang before C++20 as an extension, which is how the
    // repo's own -std=c++14 harness compiles this output.
    extensions: ["designated initializers in C++"],
    platformLib: null,
    condition: null,
    reason: ".field = value inside a braced initializer",
    incurredBy: "initializing a struct in --cpp mode",
    probe: /=\s*\{\s*\.[A-Za-z_]\w*\s*=/,
    adr: "ADR-035",
    misra: [],
  },

  "cpp-compound-literal": {
    key: "cpp-compound-literal",
    modes: ["cpp"],
    feature: "struct initializer",
    standard: "C++11",
    compiler: null,
    // Compound literals are not ISO C++ at any version.
    extensions: ["compound literals in C++"],
    platformLib: null,
    condition: null,
    reason: "(T){ ... } in C++",
    incurredBy: "a non-declaration struct literal in --cpp mode",
    probe: /=\s*\([A-Za-z_][\w:]*\)\{/,
    adr: "ADR-035",
    misra: ["1.2"],
  },

  "overflow-panic-hosted-libc": {
    key: "overflow-panic-hosted-libc",
    modes: ["c", "cpp"],
    feature: "overflow panic (--debug)",
    standard: "C99",
    compiler: null,
    extensions: [],
    platformLib: "hosted libc",
    condition: null,
    reason: "fprintf(stderr, ...), abort()",
    incurredBy: "transpiling with --debug and using a clamp type",
    probe: /fprintf\(stderr, "PANIC:/,
    adr: "ADR-044",
    misra: ["21.6", "21.8"],
  },
};

export default TOOLCHAIN_REQUIREMENTS;
