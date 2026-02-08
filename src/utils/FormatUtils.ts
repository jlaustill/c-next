/**
 * Code formatting utilities for C code generation.
 * Pure functions for text formatting and indentation.
 *
 * Extracted from CodeGenerator.ts as part of ADR-109 decomposition.
 */
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
   * Indent each line of a multi-line string.
   *
   * @param text - The text to indent (may contain newlines)
   * @param level - The indentation level
   * @returns Text with each line indented
   */
  static indentLines(text: string, level: number): string {
    const prefix = FormatUtils.indent(level);
    return text
      .split("\n")
      .map((line) => (line.length > 0 ? prefix + line : line))
      .join("\n");
  }

  /**
   * Join strings with separator, filtering out empty strings.
   *
   * @param parts - Array of strings to join
   * @param separator - Separator between parts
   * @returns Joined string with empty parts removed
   */
  static joinNonEmpty(parts: string[], separator: string): string {
    return parts.filter((p) => p.length > 0).join(separator);
  }

  /**
   * Wrap text in braces with proper formatting.
   * Used for generating C blocks like: { content }
   *
   * @param content - The content to wrap
   * @param inline - If true, format as "{ content }" on one line
   * @returns Formatted block string
   */
  static wrapInBraces(content: string, inline: boolean = false): string {
    if (inline) {
      return `{ ${content} }`;
    }
    return `{\n${content}\n}`;
  }

  /**
   * Get the appropriate scope separator for C++ vs C/C-Next.
   * C++ uses :: for scope resolution, C/C-Next uses _ (underscore).
   *
   * @param isCppContext - Whether generating C++ code
   * @returns "::" for C++ or "_" for C/C-Next
   */
  static getScopeSeparator(isCppContext: boolean): string {
    return isCppContext ? "::" : "_";
  }
}

export default FormatUtils;
