/**
 * ADR-029: the single formatter for a callback typedef's parameter list.
 *
 * The `.c` and the `.h` each used to build this string themselves, and they
 * disagreed: the header dropped `const` and array dimensions, so
 * `void (*onReceive_fp)(const Message*)` in the implementation met
 * `void (*onReceive_fp)(Message*)` in the header. Nothing caught it while the
 * `.c` did not include its own header; once it does (#1164), the two meet in
 * one translation unit and the compiler rejects the redeclaration.
 *
 * Both paths now format from here, so there is one answer to "what does this
 * typedef look like?" rather than two that happened to agree for simple cases.
 */

import type ICallbackTypedefParameter from "../types/ICallbackTypedefParameter";

class CallbackTypedefFormatter {
  /**
   * Format the parameter list between the parentheses of a callback typedef.
   */
  static formatParameterList(
    parameters: readonly ICallbackTypedefParameter[],
    isCppMode: boolean,
  ): string {
    if (parameters.length === 0) {
      return "void";
    }

    return parameters
      .map((parameter) =>
        CallbackTypedefFormatter.formatParameter(parameter, isCppMode),
      )
      .join(", ");
  }

  /**
   * Format a complete callback typedef declaration.
   */
  static format(
    returnType: string,
    typedefName: string,
    parameters: readonly ICallbackTypedefParameter[],
    isCppMode: boolean,
  ): string {
    const parameterList = CallbackTypedefFormatter.formatParameterList(
      parameters,
      isCppMode,
    );
    return `typedef ${returnType} (*${typedefName})(${parameterList});`;
  }

  private static formatParameter(
    parameter: ICallbackTypedefParameter,
    isCppMode: boolean,
  ): string {
    const constModifier = parameter.isConst ? "const " : "";

    if (parameter.isArray) {
      return `${constModifier}${parameter.type} ${parameter.name ?? ""}${parameter.arrayDims ?? ""}`;
    }

    if (parameter.isStruct) {
      // ADR-006: struct parameters become pointers in C, references in C++.
      const pointerOrReference = isCppMode ? "&" : "*";
      return `${constModifier}${parameter.type}${pointerOrReference}`;
    }

    // ADR-029: callback parameters are already function pointers.
    return parameter.type;
  }
}

export default CallbackTypedefFormatter;
