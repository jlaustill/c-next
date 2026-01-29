/**
 * Helper function generators for overflow-safe arithmetic and safe division.
 * Extracted from CodeGenerator.ts as part of ADR-053 A5.
 *
 * Portability note: Uses __builtin_add_overflow, __builtin_sub_overflow, and
 * __builtin_mul_overflow intrinsics (GCC 5+, Clang 3.4+). C-Next targets embedded
 * systems using arm-none-eabi-gcc, so these are available. MSVC is not supported.
 */
import TYPE_MAP from "../../types/TYPE_MAP";
import WIDER_TYPE_MAP from "../../types/WIDER_TYPE_MAP";
import TYPE_LIMITS from "../../types/TYPE_LIMITS";

const { TYPE_MAX, TYPE_MIN } = TYPE_LIMITS;

/**
 * Generate a single overflow helper function (clamps on overflow)
 */
function generateSingleHelper(
  operation: string,
  cnxType: string,
): string | null {
  const cType = TYPE_MAP[cnxType];
  const widerType = WIDER_TYPE_MAP[cnxType] || cType;
  const maxValue = TYPE_MAX[cnxType];
  const minValue = TYPE_MIN[cnxType];

  if (!cType || !maxValue) {
    return null;
  }

  const isUnsigned = cnxType.startsWith("u");

  // For signed types narrower than i64, use wider arithmetic to avoid UB (Issue #94)
  const useWiderArithmetic =
    !isUnsigned && widerType !== cType && cnxType !== "i64";

  switch (operation) {
    case "add":
      if (isUnsigned) {
        // Issue #231: Hybrid approach - check wide operand first, then use builtin
        // Issue #94: Wide operand check prevents truncation issues
        return `static inline ${cType} cnx_clamp_add_${cnxType}(${cType} a, ${widerType} b) {
    if (b > (${widerType})(${maxValue} - a)) return ${maxValue};
    ${cType} result;
    if (__builtin_add_overflow(a, (${cType})b, &result)) return ${maxValue};
    return result;
}`;
      } else if (useWiderArithmetic) {
        // Signed addition: compute in wider type, then clamp (Issue #94)
        // This avoids UB from casting out-of-range values
        return `static inline ${cType} cnx_clamp_add_${cnxType}(${cType} a, ${widerType} b) {
    ${widerType} result = (${widerType})a + b;
    if (result > ${maxValue}) return ${maxValue};
    if (result < ${minValue}) return ${minValue};
    return (${cType})result;
}`;
      } else {
        // i64: already widest type, use original check logic
        return `static inline ${cType} cnx_clamp_add_${cnxType}(${cType} a, ${cType} b) {
    if (b > 0 && a > ${maxValue} - b) return ${maxValue};
    if (b < 0 && a < ${minValue} - b) return ${minValue};
    return a + b;
}`;
      }

    case "sub":
      if (isUnsigned) {
        // Issue #231: Hybrid approach - check wide operand first, then use builtin
        // Issue #94: Wide operand check prevents truncation issues
        // Use > (not >=) since b == a produces valid result 0 via the builtin path
        return `static inline ${cType} cnx_clamp_sub_${cnxType}(${cType} a, ${widerType} b) {
    if (b > (${widerType})a) return 0;
    ${cType} result;
    if (__builtin_sub_overflow(a, (${cType})b, &result)) return 0;
    return result;
}`;
      } else if (useWiderArithmetic) {
        // Signed subtraction: compute in wider type, then clamp (Issue #94)
        return `static inline ${cType} cnx_clamp_sub_${cnxType}(${cType} a, ${widerType} b) {
    ${widerType} result = (${widerType})a - b;
    if (result > ${maxValue}) return ${maxValue};
    if (result < ${minValue}) return ${minValue};
    return (${cType})result;
}`;
      } else {
        // i64: already widest type, use original check logic
        return `static inline ${cType} cnx_clamp_sub_${cnxType}(${cType} a, ${cType} b) {
    if (b < 0 && a > ${maxValue} + b) return ${maxValue};
    if (b > 0 && a < ${minValue} + b) return ${minValue};
    return a - b;
}`;
      }

    case "mul":
      if (isUnsigned) {
        // Issue #231: Hybrid approach - check wide operand first, then use builtin
        // Issue #94: Wide operand check prevents truncation issues
        return `static inline ${cType} cnx_clamp_mul_${cnxType}(${cType} a, ${widerType} b) {
    if (b != 0 && a > ${maxValue} / b) return ${maxValue};
    ${cType} result;
    if (__builtin_mul_overflow(a, (${cType})b, &result)) return ${maxValue};
    return result;
}`;
      } else if (useWiderArithmetic) {
        // Signed multiplication: compute in wider type, then clamp (Issue #94)
        return `static inline ${cType} cnx_clamp_mul_${cnxType}(${cType} a, ${widerType} b) {
    ${widerType} result = (${widerType})a * b;
    if (result > ${maxValue}) return ${maxValue};
    if (result < ${minValue}) return ${minValue};
    return (${cType})result;
}`;
      } else {
        // i64: already widest type, use original check logic
        return `static inline ${cType} cnx_clamp_mul_${cnxType}(${cType} a, ${cType} b) {
    if (a == 0 || b == 0) return 0;
    if (a > 0 && b > 0 && a > ${maxValue} / b) return ${maxValue};
    if (a < 0 && b < 0 && a < ${maxValue} / b) return ${maxValue};
    if (a > 0 && b < 0 && b < ${minValue} / a) return ${minValue};
    if (a < 0 && b > 0 && a < ${minValue} / b) return ${minValue};
    return a * b;
}`;
      }

    default:
      return null;
  }
}

/**
 * Generate a single debug helper function (panics on overflow)
 */
function generateDebugHelper(
  operation: string,
  cnxType: string,
): string | null {
  const cType = TYPE_MAP[cnxType];
  const widerType = WIDER_TYPE_MAP[cnxType] || cType;
  const maxValue = TYPE_MAX[cnxType];
  const minValue = TYPE_MIN[cnxType];

  if (!cType || !maxValue) {
    return null;
  }

  const isUnsigned = cnxType.startsWith("u");
  const opNames: Record<string, string> = {
    add: "addition",
    sub: "subtraction",
    mul: "multiplication",
  };
  const opName = opNames[operation] ?? "operation";

  // For signed types narrower than i64, use wider arithmetic to avoid UB (Issue #94)
  const useWiderArithmetic =
    !isUnsigned && widerType !== cType && cnxType !== "i64";

  switch (operation) {
    case "add":
      if (isUnsigned) {
        // Issue #231: Hybrid approach - check wide operand first, then use builtin
        // Issue #94: Wide operand check prevents truncation issues
        return `static inline ${cType} cnx_clamp_add_${cnxType}(${cType} a, ${widerType} b) {
    if (b > (${widerType})(${maxValue} - a)) {
        fprintf(stderr, "PANIC: Integer overflow in ${cnxType} ${opName}\\n");
        abort();
    }
    ${cType} result;
    if (__builtin_add_overflow(a, (${cType})b, &result)) {
        fprintf(stderr, "PANIC: Integer overflow in ${cnxType} ${opName}\\n");
        abort();
    }
    return result;
}`;
      } else if (useWiderArithmetic) {
        // Signed addition: compute in wider type, check bounds (Issue #94)
        return `static inline ${cType} cnx_clamp_add_${cnxType}(${cType} a, ${widerType} b) {
    ${widerType} result = (${widerType})a + b;
    if (result > ${maxValue} || result < ${minValue}) {
        fprintf(stderr, "PANIC: Integer overflow in ${cnxType} ${opName}\\n");
        abort();
    }
    return (${cType})result;
}`;
      } else {
        // i64: already widest type, use original check logic
        return `static inline ${cType} cnx_clamp_add_${cnxType}(${cType} a, ${cType} b) {
    if ((b > 0 && a > ${maxValue} - b) || (b < 0 && a < ${minValue} - b)) {
        fprintf(stderr, "PANIC: Integer overflow in ${cnxType} ${opName}\\n");
        abort();
    }
    return a + b;
}`;
      }

    case "sub":
      if (isUnsigned) {
        // Issue #231: Hybrid approach - check wide operand first, then use builtin
        // Issue #94: Wide operand check prevents truncation issues
        // Use > (not >=) since b == a produces valid result 0 via the builtin path
        return `static inline ${cType} cnx_clamp_sub_${cnxType}(${cType} a, ${widerType} b) {
    if (b > (${widerType})a) {
        fprintf(stderr, "PANIC: Integer underflow in ${cnxType} ${opName}\\n");
        abort();
    }
    ${cType} result;
    if (__builtin_sub_overflow(a, (${cType})b, &result)) {
        fprintf(stderr, "PANIC: Integer underflow in ${cnxType} ${opName}\\n");
        abort();
    }
    return result;
}`;
      } else if (useWiderArithmetic) {
        // Signed subtraction: compute in wider type, check bounds (Issue #94)
        return `static inline ${cType} cnx_clamp_sub_${cnxType}(${cType} a, ${widerType} b) {
    ${widerType} result = (${widerType})a - b;
    if (result > ${maxValue} || result < ${minValue}) {
        fprintf(stderr, "PANIC: Integer overflow in ${cnxType} ${opName}\\n");
        abort();
    }
    return (${cType})result;
}`;
      } else {
        // i64: already widest type, use original check logic
        return `static inline ${cType} cnx_clamp_sub_${cnxType}(${cType} a, ${cType} b) {
    if ((b < 0 && a > ${maxValue} + b) || (b > 0 && a < ${minValue} + b)) {
        fprintf(stderr, "PANIC: Integer overflow in ${cnxType} ${opName}\\n");
        abort();
    }
    return a - b;
}`;
      }

    case "mul":
      if (isUnsigned) {
        // Issue #231: Hybrid approach - check wide operand first, then use builtin
        // Issue #94: Wide operand check prevents truncation issues
        return `static inline ${cType} cnx_clamp_mul_${cnxType}(${cType} a, ${widerType} b) {
    if (b != 0 && a > ${maxValue} / b) {
        fprintf(stderr, "PANIC: Integer overflow in ${cnxType} ${opName}\\n");
        abort();
    }
    ${cType} result;
    if (__builtin_mul_overflow(a, (${cType})b, &result)) {
        fprintf(stderr, "PANIC: Integer overflow in ${cnxType} ${opName}\\n");
        abort();
    }
    return result;
}`;
      } else if (useWiderArithmetic) {
        // Signed multiplication: compute in wider type, check bounds (Issue #94)
        return `static inline ${cType} cnx_clamp_mul_${cnxType}(${cType} a, ${widerType} b) {
    ${widerType} result = (${widerType})a * b;
    if (result > ${maxValue} || result < ${minValue}) {
        fprintf(stderr, "PANIC: Integer overflow in ${cnxType} ${opName}\\n");
        abort();
    }
    return (${cType})result;
}`;
      } else {
        // i64: already widest type, use original check logic
        return `static inline ${cType} cnx_clamp_mul_${cnxType}(${cType} a, ${cType} b) {
    if (a != 0 && b != 0) {
        if ((a > 0 && b > 0 && a > ${maxValue} / b) ||
            (a < 0 && b < 0 && a < ${maxValue} / b) ||
            (a > 0 && b < 0 && b < ${minValue} / a) ||
            (a < 0 && b > 0 && a < ${minValue} / b)) {
            fprintf(stderr, "PANIC: Integer overflow in ${cnxType} ${opName}\\n");
            abort();
        }
    }
    return a * b;
}`;
      }

    default:
      return null;
  }
}

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
      ? generateDebugHelper(operation, cnxType)
      : generateSingleHelper(operation, cnxType);
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

  lines.push(
    "// ADR-051: Safe division helper functions",
    "#include <stdbool.h>",
    "",
  );

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
      lines.push(
        `static inline bool cnx_safe_div_${cnxType}(${cType}* output, ${cType} numerator, ${cType} divisor, ${cType} defaultValue) {`,
        `    if (divisor == 0) {`,
        `        *output = defaultValue;`,
        `        return true;  // Error occurred`,
        `    }`,
        `    *output = numerator / divisor;`,
        `    return false;  // Success`,
        `}`,
        "",
      );
    }

    // Generate safe_mod helper if needed
    if (needsMod) {
      lines.push(
        `static inline bool cnx_safe_mod_${cnxType}(${cType}* output, ${cType} numerator, ${cType} divisor, ${cType} defaultValue) {`,
        `    if (divisor == 0) {`,
        `        *output = defaultValue;`,
        `        return true;  // Error occurred`,
        `    }`,
        `    *output = numerator % divisor;`,
        `    return false;  // Success`,
        `}`,
        "",
      );
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
