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
}

export default CodeGenErrors;
