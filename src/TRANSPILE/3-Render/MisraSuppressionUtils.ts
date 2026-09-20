/**
 * MISRA Suppression Utilities
 *
 * Issue #850: Shared helpers for emitting MISRA inline suppression comments.
 * Used by both CodeGenerator (for .c files) and HeaderGeneratorUtils (for .h files).
 */

/**
 * Headers that violate MISRA C:2012 rules and need inline suppression.
 * Maps header name to the MISRA rule it violates.
 */
const MISRA_BANNED_HEADERS: ReadonlyMap<string, string> = new Map([
  // MISRA Rule 21.6: Standard library I/O functions shall not be used
  ["stdio.h", "misra-c2012-21.6"],
]);

/**
 * Regex to extract header name from angle-bracket includes.
 * Uses possessive matching via atomic group simulation to avoid backtracking.
 * Matches: #include <header.h> -> captures "header.h"
 */
const ANGLE_BRACKET_INCLUDE_REGEX = /<([^<>]+)>/;

/**
 * Check if an include directive needs MISRA suppression.
 * @param includeText The full include directive (e.g., "#include <stdio.h>")
 * @returns true if suppression is needed
 */
function needsMisraSuppression(includeText: string): boolean {
  const match = ANGLE_BRACKET_INCLUDE_REGEX.exec(includeText);
  if (!match) return false;
  return MISRA_BANNED_HEADERS.has(match[1]);
}

/**
 * Get the MISRA suppression comment for an include directive.
 * @param includeText The full include directive (e.g., "#include <stdio.h>")
 * @returns The suppression comment, or null if not needed
 */
function getMisraSuppressionComment(includeText: string): string | null {
  const match = ANGLE_BRACKET_INCLUDE_REGEX.exec(includeText);
  if (!match) return null;
  const rule = MISRA_BANNED_HEADERS.get(match[1]);
  return rule ? `// cppcheck-suppress ${rule}` : null;
}

const MisraSuppressionUtils = {
  needsMisraSuppression,
  getMisraSuppressionComment,
};

export default MisraSuppressionUtils;
