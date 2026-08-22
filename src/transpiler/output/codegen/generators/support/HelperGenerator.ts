/**
 * Helper function generators for overflow-safe arithmetic and safe division.
 * Extracted from CodeGenerator.ts as part of ADR-053 A5.
 *
 * Portability note: Uses __builtin_add_overflow, __builtin_sub_overflow, and
 * __builtin_mul_overflow intrinsics (GCC 5+, Clang 3.4+). C-Next targets embedded
 * systems using arm-none-eabi-gcc, so these are available. MSVC is not supported.
 *
 * Issue #707: Refactored to use OverflowHelperTemplates for reduced duplication.
 */
import TYPE_MAP from "../../types/TYPE_MAP";
import OverflowHelperTemplates from "./OverflowHelperTemplates";

/**
 * Generate a safe arithmetic helper function (div or mod).
 * Extracted to eliminate duplication between safe_div and safe_mod generation.
 */
const generateSafeArithmeticHelper = (
  opName: string,
  opSymbol: string,
  cnxType: string,
  cType: string,
): string[] => [
  `static inline bool cnx_safe_${opName}_${cnxType}(${cType}* output, ${cType} numerator, ${cType} divisor, ${cType} defaultValue) {`,
  `    if (divisor == 0) {`,
  `        *output = defaultValue;`,
  `        return true;  // Error occurred`,
  `    }`,
  `    *output = numerator ${opSymbol} divisor;`,
  `    return false;  // Success`,
  `}`,
  "",
];

/**
 * Generate all needed overflow helper functions
 * ADR-044: Overflow helper functions with clamping or panic behavior
 */
const generateOverflowHelpers = (
  usedClampOps: ReadonlySet<string>,
  debugMode: boolean,
): string[] => {
  if (usedClampOps.size === 0) {
    return [];
  }

  const lines: string[] = [];

  // ADR-044: Emit a compile-time guard so unsupported toolchains fail with a
  // clear diagnostic rather than an implicit-declaration error at the first use.
  // See https://github.com/jlaustill/c-next/issues/1129
  // The #ifdef __cppcheck__ wrapper uses a positive check (empty when cppcheck
  // is running) to work around a cppcheck preprocessor bug where nested #if/#elif
  // inside #ifndef is not fully skipped.
  lines.push(
    "/* ADR-044: the clamp/wrap helpers below use __builtin_add_overflow,",
    "   __builtin_sub_overflow and __builtin_mul_overflow. These are GCC 5+ / Clang 3.4+",
    "   extensions, not standard C99, and are chosen because they lower to a single",
    "   add-and-branch-on-carry on Cortex-M. Fail here rather than at the first use */",
    "#ifdef __cppcheck__",
    "/* cppcheck bug: nested #if/#elif inside #ifndef is not fully skipped,",
    "   so we use a positive check (empty body) instead. */",
    "#else",
    "#if defined(__clang__)",
    "#if (__clang_major__ < 3) || ((__clang_major__ == 3) && (__clang_minor__ < 4))",
    '#error "C-Next overflow helpers require Clang 3.4 or later (__builtin_add_overflow)."',
    "#endif",
    "#elif defined(__GNUC__)",
    "#if __GNUC__ < 5",
    '#error "C-Next overflow helpers require GCC 5 or later (__builtin_add_overflow)."',
    "#endif",
    "#else",
    '#error "C-Next overflow helpers require GCC 5+ or Clang 3.4+ (__builtin_add_overflow)."',
    "#endif",
    "#endif /* __cppcheck__ */",
    "",
  );

  if (debugMode) {
    lines.push(
      "// ADR-044: Debug overflow helper functions (panic on overflow)",
      "#include <limits.h>",
      "#include <stdio.h>",
      "#include <stdlib.h>",
      "",
    );
  } else {
    lines.push(
      "// ADR-044: Overflow helper functions",
      "#include <limits.h>",
      "",
    );
  }

  // Sort for deterministic output
  const sortedOps = Array.from(usedClampOps).sort((a, b) => a.localeCompare(b));

  for (const op of sortedOps) {
    const [operation, cnxType] = op.split("_");
    const helper = debugMode
      ? OverflowHelperTemplates.generatePanicHelper(operation, cnxType)
      : OverflowHelperTemplates.generateClampHelper(operation, cnxType);
    if (helper) {
      lines.push(helper, "");
    }
  }

  return lines;
};

/**
 * Generate safe division helper functions for used integer types only
 * ADR-051: Safe division helpers that return error flag on division by zero
 */
const generateSafeDivHelpers = (
  usedSafeDivOps: ReadonlySet<string>,
): string[] => {
  if (usedSafeDivOps.size === 0) {
    return [];
  }

  const lines: string[] = [];

  // Issue #1108: the <stdbool.h> dependency (helpers return a bool error flag)
  // is signalled via requireInclude("stdbool") when the safe-div effect is
  // applied, so it flows through the single addAutoIncludes path. Emitting it
  // here too would duplicate the include.
  lines.push("// ADR-051: Safe division helper functions", "");

  const integerTypes = ["u8", "u16", "u32", "u64", "i8", "i16", "i32", "i64"];

  for (const cnxType of integerTypes) {
    const needsDiv = usedSafeDivOps.has(`div_${cnxType}`);
    const needsMod = usedSafeDivOps.has(`mod_${cnxType}`);

    if (!needsDiv && !needsMod) {
      continue; // Skip types that aren't used
    }

    const cType = TYPE_MAP[cnxType];

    // Generate safe_div helper if needed
    if (needsDiv) {
      lines.push(...generateSafeArithmeticHelper("div", "/", cnxType, cType));
    }

    // Generate safe_mod helper if needed
    if (needsMod) {
      lines.push(...generateSafeArithmeticHelper("mod", "%", cnxType, cType));
    }
  }

  return lines;
};

// Export as an object for consistent module pattern
const helperGenerators = {
  generateOverflowHelpers,
  generateSafeDivHelpers,
};

export default helperGenerators;
