/**
 * Code formatting utilities for C code generation.
 * Pure functions for text formatting and indentation.
 *
 * Extracted from CodeGenerator.ts as part of ADR-065 decomposition.
 */

import QualifiedCName from "./QualifiedCName";

class FormatUtils {
  /** Default indentation string (4 spaces) */
  static readonly INDENT = "    ";

  /**
   * Generate indentation string for the given level.
   * Uses 4 spaces per level, matching C-Next coding style.
   *
   * @param level - The indentation level (0 = no indent)
   * @returns String of spaces for indentation
   */
  static indent(level: number): string {
    return FormatUtils.INDENT.repeat(level);
  }

  /**
   * Indent ALL lines of a multi-line string (including empty lines).
   *
   * @param text - The text to indent (may contain newlines)
   * @param level - The indentation level
   * @returns Text with every line indented
   */
  static indentAllLines(text: string, level: number): string {
    const prefix = FormatUtils.indent(level);
    return text
      .split("\n")
      .map((line) => prefix + line)
      .join("\n");
  }

  /**
   * Get the appropriate scope separator for C++ vs C/C-Next.
   *
   * C++ namespace qualification uses `::`; C output uses the C-Next
   * qualified-name separator, which QualifiedCName owns (ADR-063).
   *
   * @param isCppContext - Whether generating C++ code
   * @returns "::" for C++ or the qualified-name separator for C/C-Next
   */
  static getScopeSeparator(isCppContext: boolean): string {
    return isCppContext ? "::" : QualifiedCName.SEPARATOR;
  }
}

export default FormatUtils;
