/**
 * Centralized error messages for CodeGenerator.
 * Extracted to improve testability of error paths.
 */

/**
 * Error messages and factories for code generation errors.
 */
class CodeGenErrors {
  /**
   * Error when using bracket indexing on a bitmap type.
   * Bitmap fields must be accessed by name, not index.
   */
  static bitmapBracketIndexing(
    line: number,
    bitmapTypeName: string,
    varName: string,
  ): Error {
    return new Error(
      `Error at line ${line}: Cannot use bracket indexing on bitmap type '${bitmapTypeName}'. ` +
        `Use named field access instead (e.g., ${varName}.FIELD_NAME).`,
    );
  }

  /**
   * Error when float bit indexing is used at global scope.
   * Float bit reads require shadow variables which need function scope.
   */
  static floatBitIndexingAtGlobalScope(
    rawName: string,
    start: string,
    width: string,
  ): Error {
    return new Error(
      `Float bit indexing reads (${rawName}[${start}, ${width}]) cannot be used at global scope. ` +
        `Move the initialization inside a function.`,
    );
  }

  /**
   * Error when this.Type is used outside of a scope.
   */
  static scopedTypeOutsideScope(): Error {
    return new Error("Error: 'this.Type' can only be used inside a scope");
  }

  /**
   * Error when sizeof is called on an array parameter.
   * C passes arrays as pointers, so sizeof would return pointer size.
   */
  static sizeofArrayParameter(varName: string): Error {
    return new Error(
      `Error: Cannot use sizeof on array parameter '${varName}'. ` +
        `Array parameters are passed as pointers in C, so sizeof would return the pointer size, not the array size. ` +
        `Pass the array size as a separate parameter instead.`,
    );
  }

  /**
   * Error when a required type context is missing.
   */
  static missingTypeContext(context: string): Error {
    return new Error(`Error: Missing type context in ${context}`);
  }

  /**
   * Error when an unsupported expression is encountered in sizeof.
   */
  static unsupportedSizeofExpression(exprText: string): Error {
    return new Error(
      `Error: Unsupported expression in sizeof: ${exprText}. ` +
        `sizeof supports types, variables, and simple expressions.`,
    );
  }

  /**
   * Issue #1106: too many subscripts on a variable. Per ADR-036 each subscript
   * peels one array dimension; per ADR-007 a scalar integer/float may be
   * bit-indexed once. So a base allows at most arrayDimensions + 1 subscripts.
   * Indexing further indexes a value that is not an array (e.g. `flags[4][3]`
   * on a scalar `u8` indexes the single bit `flags[4]`).
   */
  static tooManySubscripts(
    line: number,
    varName: string,
    baseType: string,
    arrayDimensions: number,
  ): Error {
    const allowed = arrayDimensions + 1;
    const shape =
      arrayDimensions === 0
        ? `a scalar '${baseType}'`
        : `a ${arrayDimensions}-dimensional '${baseType}' array`;
    const plural = allowed === 1 ? "subscript" : "subscripts";
    return new Error(
      `Error at line ${line}: too many subscripts on '${varName}'. ` +
        `'${varName}' is ${shape}, so it allows at most ${allowed} ${plural} ` +
        `(${arrayDimensions} for array ${arrayDimensions === 1 ? "dimension" : "dimensions"} ` +
        `plus one optional bit index — ADR-036/ADR-007). Indexing further indexes a ` +
        `value that is not an array. Did you mean the bit range '${varName}[start, width]'?`,
    );
  }
}

export default CodeGenErrors;
