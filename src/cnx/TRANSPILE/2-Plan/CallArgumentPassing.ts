import type ICallArgumentFacts from "./types/ICallArgumentFacts";
import type IPlanQueries from "./types/IPlanQueries";
import CallExprUtils from "./CallExprUtils";
import type IArgumentPassing from "./types/IArgumentPassing";

/**
 * How a call passes each argument: the parameter it binds to, and whether it
 * goes to a C function, by value or by reference. 2.3 writes the argument
 * this way, and 2.2 plans the type it is written against from the same
 * answer (#1991).
 */
class CallArgumentPassing {
  /**
   * The function a callback-typed callee names: the name a call through it
   * looks its parameters up by.
   *
   * ADR-029: a value of a callback type -- a struct field, a variable, a
   * parameter -- holds a function with the parameters of the function that IS
   * the type. A call through it takes exactly the arguments a direct call to
   * that function takes, so every question about them is asked of that
   * function's name. Asked of `h.onPeek`, which names no function, they found no
   * parameters, and a struct argument went by value into a `const Point*`.
   */
  static callbackFunction(
    calleeType: string | null,
    input: ICallArgumentFacts,
  ): string | undefined {
    return calleeType === null
      ? undefined
      : input.callbackTypes.get(calleeType)?.functionName;
  }

  /**
   * Issue #304: the integer C type a C++ enum class argument is cast to for
   * an integer parameter, or null
   */
  static cppEnumCast(
    argType: string | null,
    targetParamBaseType: string | undefined,
    orchestrator: IPlanQueries,
  ): string | null {
    if (!orchestrator.isCppMode() || !targetParamBaseType) return null;
    if (argType === null || !orchestrator.isCppEnumClass(argType)) return null;
    return orchestrator.isIntegerType(targetParamBaseType)
      ? CallExprUtils.mapTypeToCType(targetParamBaseType)
      : null;
  }

  /** Argument `index` of a call to `signatureName`; null when it names none */
  static of(
    signatureName: string | null,
    index: number,
    input: ICallArgumentFacts,
    orchestrator: IPlanQueries,
  ): IArgumentPassing {
    if (signatureName === null) return { param: undefined, mode: "c" };
    const resolved = CallExprUtils.resolveTargetParam(
      input.functionSignatures.get(signatureName),
      index,
      signatureName,
      input.symbolTable,
    );
    if (!orchestrator.isCNextFunction(signatureName)) {
      return { param: resolved.param, mode: "c" };
    }
    return {
      param: resolved.param,
      mode: CallArgumentPassing.shouldPassByValue(
        signatureName,
        index,
        resolved.param,
        resolved.isCrossFile,
        orchestrator,
      )
        ? "value"
        : "reference",
    };
  }

  /** Determine if a C-Next parameter should be passed by value. */
  private static shouldPassByValue(
    funcExpr: string,
    idx: number,
    targetParam: IArgumentPassing["param"],
    isCrossFile: boolean,
    orchestrator: IPlanQueries,
  ): boolean {
    if (!targetParam) return false;

    const isFloatParam = orchestrator.isFloatType(targetParam.baseType);
    const isEnumParam = orchestrator.getKnownEnums().has(targetParam.baseType);
    const isPrimitivePassByValue = orchestrator.isParameterPassByValue(
      funcExpr,
      idx,
    );

    // Issue #786: For cross-file calls, check if parameter is a known primitive type.
    // Known primitives (u8-u64, i8-i64, bool) should always be pass-by-value.
    // This handles the case where local passByValueParams isn't populated for cross-file functions.
    const isCrossFilePrimitive =
      isCrossFile &&
      CallExprUtils.isKnownPrimitiveType(targetParam.baseType) &&
      !orchestrator.isKnownStruct(targetParam.baseType) &&
      !CallExprUtils.isStringType(targetParam.baseType);

    // Issue #551: Unknown types (external enums, typedefs) use pass-by-value
    //
    // ADR-030 / #1722: an opaque handle lands here too, and that is the right
    // route rather than a lucky one -- the handle's C value IS the pointer the
    // callee's `T*` parameter takes. Rendering an opaque PARAMETER as that value
    // is the parameter registry's decision (`TParameterInfo.isOpaqueHandle`),
    // not this function's. The by-reference route would take `&` of every opaque
    // scope variable and array element (`&UI__held`), which #996's and #1722's
    // fixtures pin.
    const isUnknownType =
      !orchestrator.isKnownStruct(targetParam.baseType) &&
      !CallExprUtils.isKnownPrimitiveType(targetParam.baseType) &&
      !CallExprUtils.isStringType(targetParam.baseType) &&
      !isFloatParam &&
      !isEnumParam &&
      !isCrossFilePrimitive;

    return (
      isFloatParam ||
      isEnumParam ||
      isPrimitivePassByValue ||
      isCrossFilePrimitive ||
      isUnknownType
    );
  }
}

export default CallArgumentPassing;
