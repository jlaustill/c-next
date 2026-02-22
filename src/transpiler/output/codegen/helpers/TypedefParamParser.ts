/**
 * TypedefParamParser - Parses C function pointer typedef signatures
 *
 * Extracts parameter types from typedef strings like:
 *   "void (*)(widget_t *, const rect_t *, uint8_t *)"
 *   "void (*)(Point p)"
 *
 * Used by Issue #895 to determine if callback params should be pointers or values.
 */

/**
 * Parsed parameter info from a typedef.
 */
interface ITypedefParam {
  /** Full type string (e.g., "widget_t *", "const rect_t *", "uint8_t *") */
  type: string;
  /** Whether this is a pointer type */
  isPointer: boolean;
  /** Whether this has const qualifier */
  isConst: boolean;
  /** Base type without pointer/const (e.g., "widget_t", "rect_t", "uint8_t") */
  baseType: string;
}

/**
 * Parse result for a typedef signature.
 */
interface ITypedefParseResult {
  /** Return type */
  returnType: string;
  /** Parsed parameters */
  params: ITypedefParam[];
}

class TypedefParamParser {
  /**
   * Parse a function pointer typedef type string.
   *
   * @param typedefType - The type string, e.g., "void (*)(widget_t *, const rect_t *, uint8_t *)"
   * @returns Parsed result with return type and parameters, or null if parsing fails
   */
  static parse(typedefType: string): ITypedefParseResult | null {
    // Expected format: "return_type (*)(param1, param2, ...)"
    // Find the (*) marker first
    const funcPtrIndex = typedefType.indexOf("(*)");
    if (funcPtrIndex === -1) {
      return null;
    }

    const returnType = typedefType.substring(0, funcPtrIndex).trim();

    // Find the opening paren after (*)
    const afterFuncPtr = typedefType.substring(funcPtrIndex + 3).trim();
    if (!afterFuncPtr.startsWith("(")) {
      return null;
    }

    // Extract params by finding the matching closing paren
    const paramsStr = TypedefParamParser.extractParenContent(afterFuncPtr);
    if (paramsStr === null) {
      return null;
    }

    // Handle void or empty params
    if (!paramsStr || paramsStr === "void") {
      return { returnType, params: [] };
    }

    // Split by comma, handling nested parentheses
    const paramStrings = TypedefParamParser.splitParams(paramsStr);
    const params = paramStrings.map((p) => TypedefParamParser.parseParam(p));

    return { returnType, params };
  }

  /**
   * Extract content between matching parentheses, handling arbitrary nesting.
   * @param str - String starting with '('
   * @returns Content between outer parens, or null if no match
   */
  private static extractParenContent(str: string): string | null {
    if (!str.startsWith("(")) {
      return null;
    }

    let depth = 0;
    for (let i = 0; i < str.length; i++) {
      if (str[i] === "(") {
        depth++;
      } else if (str[i] === ")") {
        depth--;
        if (depth === 0) {
          // Found matching close paren - return content between
          return str.substring(1, i);
        }
      }
    }

    // No matching close paren found
    return null;
  }

  /**
   * Split parameter string by commas, respecting nested parentheses.
   */
  private static splitParams(paramsStr: string): string[] {
    const params: string[] = [];
    let current = "";
    let depth = 0;

    for (const char of paramsStr) {
      if (char === "(") {
        depth++;
        current += char;
      } else if (char === ")") {
        depth--;
        current += char;
      } else if (char === "," && depth === 0) {
        params.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }

    if (current.trim()) {
      params.push(current.trim());
    }

    return params;
  }

  /**
   * Parse a single parameter type string.
   */
  private static parseParam(paramStr: string): ITypedefParam {
    const trimmed = paramStr.trim();

    // Check for pointer
    const isPointer = trimmed.includes("*");

    // Check for const - handles both "const " (with space) and merged forms
    // C grammar getText() strips spaces, so "const rect_t*" may appear merged
    const isConst = /\bconst\b/.test(trimmed) || trimmed.startsWith("const");

    // Extract base type (remove const, *, and param name if present)
    let baseType = trimmed
      .replaceAll(/\bconst\b/g, "") // Remove const (with word boundary)
      .replace(/^const/, "") // Remove const at start (no space case) - only once
      .replaceAll("*", "") // Remove pointers
      .replaceAll(/\s+/g, " ") // Normalize whitespace
      .trim();

    // Remove trailing param name if present (e.g., "rect_t area" -> "rect_t")
    // Only remove if there are multiple words (space-separated)
    if (baseType.includes(" ")) {
      baseType = baseType.replace(/\s+\w+$/, "");
    }

    // Handle struct keyword
    if (baseType.startsWith("struct ")) {
      baseType = baseType.substring(7);
    }

    return {
      type: trimmed,
      isPointer,
      isConst,
      baseType,
    };
  }

  /**
   * Get the parameter info at a given index, or null if not found.
   */
  private static getParamAt(
    typedefType: string,
    paramIndex: number,
  ): ITypedefParam | null {
    const parsed = TypedefParamParser.parse(typedefType);
    if (!parsed || paramIndex >= parsed.params.length) {
      return null;
    }
    return parsed.params[paramIndex];
  }

  /**
   * Check if a parameter at a given index should be a pointer based on the typedef.
   *
   * @param typedefType - The typedef type string
   * @param paramIndex - The parameter index (0-based)
   * @returns true if the param should be a pointer, false for value, null if unknown
   */
  static shouldBePointer(
    typedefType: string,
    paramIndex: number,
  ): boolean | null {
    return (
      TypedefParamParser.getParamAt(typedefType, paramIndex)?.isPointer ?? null
    );
  }

  /**
   * Check if a parameter at a given index should be const based on the typedef.
   *
   * @param typedefType - The typedef type string
   * @param paramIndex - The parameter index (0-based)
   * @returns true if the param should be const, false otherwise, null if unknown
   */
  static shouldBeConst(
    typedefType: string,
    paramIndex: number,
  ): boolean | null {
    return (
      TypedefParamParser.getParamAt(typedefType, paramIndex)?.isConst ?? null
    );
  }
}

export default TypedefParamParser;
