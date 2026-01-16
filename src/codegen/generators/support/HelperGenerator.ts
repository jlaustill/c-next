/**
 * Helper function generators for overflow-safe arithmetic and safe division.
 * Extracted from CodeGenerator.ts as part of ADR-053 A5.
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
        // Unsigned addition: use wider type for b to prevent truncation (Issue #94)
        return `static inline ${cType} cnx_clamp_add_${cnxType}(${cType} a, ${widerType} b) {
    if (b > ${maxValue} - a) return ${maxValue};
    return a + (${cType})b;
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
        // Unsigned subtraction: use wider type for b to prevent truncation (Issue #94)
        // Cast a to wider type for comparison to handle b > type max
        return `static inline ${cType} cnx_clamp_sub_${cnxType}(${cType} a, ${widerType} b) {
    if (b >= (${widerType})a) return 0;
    return a - (${cType})b;
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
        // Unsigned multiplication: use wider type for b to prevent truncation (Issue #94)
        return `static inline ${cType} cnx_clamp_mul_${cnxType}(${cType} a, ${widerType} b) {
    if (b != 0 && a > ${maxValue} / b) return ${maxValue};
    return a * (${cType})b;
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
  const opName =
    operation === "add"
      ? "addition"
      : operation === "sub"
        ? "subtraction"
        : "multiplication";

  // For signed types narrower than i64, use wider arithmetic to avoid UB (Issue #94)
  const useWiderArithmetic =
    !isUnsigned && widerType !== cType && cnxType !== "i64";

  switch (operation) {
    case "add":
      if (isUnsigned) {
        // Use wider type for b to prevent truncation (Issue #94)
        return `static inline ${cType} cnx_clamp_add_${cnxType}(${cType} a, ${widerType} b) {
    if (b > ${maxValue} - a) {
        fprintf(stderr, "PANIC: Integer overflow in ${cnxType} ${opName}\\n");
        abort();
    }
    return a + (${cType})b;
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
        // Use wider type for b to prevent truncation (Issue #94)
        return `static inline ${cType} cnx_clamp_sub_${cnxType}(${cType} a, ${widerType} b) {
    if (b >= (${widerType})a) {
        fprintf(stderr, "PANIC: Integer underflow in ${cnxType} ${opName}\\n");
        abort();
    }
    return a - (${cType})b;
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
        // Use wider type for b to prevent truncation (Issue #94)
        return `static inline ${cType} cnx_clamp_mul_${cnxType}(${cType} a, ${widerType} b) {
    if (b != 0 && a > ${maxValue} / b) {
        fprintf(stderr, "PANIC: Integer overflow in ${cnxType} ${opName}\\n");
        abort();
    }
    return a * (${cType})b;
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
    );
    lines.push("#include <limits.h>");
    lines.push("#include <stdio.h>");
    lines.push("#include <stdlib.h>");
  } else {
    lines.push("// ADR-044: Overflow helper functions");
    lines.push("#include <limits.h>");
  }
  lines.push("");

  // Sort for deterministic output
  const sortedOps = Array.from(usedClampOps).sort();

  for (const op of sortedOps) {
    const [operation, cnxType] = op.split("_");
    const helper = debugMode
      ? generateDebugHelper(operation, cnxType)
      : generateSingleHelper(operation, cnxType);
    if (helper) {
      lines.push(helper);
      lines.push("");
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

  lines.push("// ADR-051: Safe division helper functions");
  lines.push("#include <stdbool.h>");
  lines.push("");

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
      );
      lines.push(`    if (divisor == 0) {`);
      lines.push(`        *output = defaultValue;`);
      lines.push(`        return true;  // Error occurred`);
      lines.push(`    }`);
      lines.push(`    *output = numerator / divisor;`);
      lines.push(`    return false;  // Success`);
      lines.push(`}`);
      lines.push("");
    }

    // Generate safe_mod helper if needed
    if (needsMod) {
      lines.push(
        `static inline bool cnx_safe_mod_${cnxType}(${cType}* output, ${cType} numerator, ${cType} divisor, ${cType} defaultValue) {`,
      );
      lines.push(`    if (divisor == 0) {`);
      lines.push(`        *output = defaultValue;`);
      lines.push(`        return true;  // Error occurred`);
      lines.push(`    }`);
      lines.push(`    *output = numerator % divisor;`);
      lines.push(`    return false;  // Success`);
      lines.push(`}`);
      lines.push("");
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
