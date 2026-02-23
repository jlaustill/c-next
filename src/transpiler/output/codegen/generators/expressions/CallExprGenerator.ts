/**
 * Function Call Expression Generator (ADR-053 A2 Phase 5)
 *
 * Generates C code for function calls:
 * - safe_div/safe_mod built-in functions (ADR-051)
 * - C-Next function calls with pass-by-reference semantics
 * - C function calls with pass-by-value semantics
 * - Const-to-non-const validation (ADR-013)
 */
import {
  ArgumentListContext,
  ExpressionContext,
} from "../../../../logic/parser/grammar/CNextParser";
import IGeneratorOutput from "../IGeneratorOutput";
import TGeneratorEffect from "../TGeneratorEffect";
import IGeneratorInput from "../IGeneratorInput";
import IGeneratorState from "../IGeneratorState";
import IOrchestrator from "../IOrchestrator";
import CallExprUtils from "./CallExprUtils";
import CodeGenState from "../../../../state/CodeGenState";
import C_TYPE_WIDTH from "../../types/C_TYPE_WIDTH";

/**
 * Issue #304: Wrap argument with static_cast if it's a C++ enum class
 * being passed to an integer parameter.
 *
 * @param argCode - The generated argument code
 * @param argExpr - The argument expression context (for type lookup)
 * @param targetParamBaseType - The target parameter's base type (if known)
 * @param orchestrator - Orchestrator for type checking methods
 * @returns The argument code, possibly wrapped with static_cast
 */
const wrapWithCppEnumCast = (
  argCode: string,
  argExpr: ExpressionContext,
  targetParamBaseType: string | undefined,
  orchestrator: IOrchestrator,
): string => {
  if (!orchestrator.isCppMode() || !targetParamBaseType) {
    return argCode;
  }

  const argType = orchestrator.getExpressionType(argExpr);
  if (argType && orchestrator.isCppEnumClass(argType)) {
    if (orchestrator.isIntegerType(targetParamBaseType)) {
      const cType = CallExprUtils.mapTypeToCType(targetParamBaseType);
      return `static_cast<${cType}>(${argCode})`;
    }
  }

  return argCode;
};

/**
 * Resolved parameter info from local signature or cross-file lookup
 */
interface IResolvedParam {
  param: { baseType: string; isArray?: boolean } | undefined;
  isCrossFile: boolean;
}

/**
 * Issue #832: Check if parameter expects address-of for typedef'd pointer types.
 *
 * When a parameter type is `T*` and the argument type is `T`, we need to add `&`.
 * This handles cases like `handle_t` (typedef'd pointer) passed to `handle_t*`.
 *
 * IMPORTANT: This should NOT match primitive types like uint8_t, because arrays
 * of primitives decay to pointers naturally (uint8_t[] → uint8_t*).
 * It SHOULD match typedef'd pointer types like handle_t → handle_t*.
 *
 * @param paramType - The parameter's base type (e.g., "handle_t*")
 * @param argType - The argument's type (e.g., "handle_t")
 * @param orchestrator - For type checking (isIntegerType, isFloatType)
 * @returns true if parameter expects `argType*` (address-of needed)
 */
const _parameterExpectsAddressOf = (
  paramType: string,
  argType: string,
  orchestrator: IOrchestrator,
): boolean => {
  // Don't add & for primitive types - arrays decay to pointers naturally
  // e.g., uint8_t[] passed to uint8_t* should NOT get &
  // Check C-Next primitives (u8, i8, etc.)
  if (
    orchestrator.isIntegerType(argType) ||
    orchestrator.isFloatType(argType) ||
    CallExprUtils.isKnownPrimitiveType(argType)
  ) {
    return false;
  }

  // Check C standard types (uint8_t, int32_t, etc.)
  if (argType in C_TYPE_WIDTH) {
    return false;
  }

  // paramType should end with * (already checked by caller)
  // Remove trailing pointer markers to get the base type
  // Use indexOf/slice instead of regex to avoid ReDoS concerns (SonarCloud S5852)
  const starIndex = paramType.indexOf("*");
  const paramBaseType =
    starIndex >= 0 ? paramType.slice(0, starIndex).trim() : paramType.trim();
  return paramBaseType === argType;
};

/**
 * Generate argument code for a C/C++ function call.
 * Handles automatic address-of (&) for struct arguments passed to pointer params.
 * Issue #872: Sets expectedType for MISRA 7.2 U suffix on unsigned literals.
 */
const _generateCFunctionArg = (
  e: ExpressionContext,
  targetParam: IResolvedParam["param"],
  input: IGeneratorInput,
  orchestrator: IOrchestrator,
): string => {
  // Issue #937: Check if argument is a callback-promoted parameter (already a pointer)
  // BEFORE generating the expression. If target expects a pointer and we have a
  // callback-promoted param, use the identifier directly instead of dereferencing.
  const argIdentifier = orchestrator.getSimpleIdentifier(e);
  const paramInfo = argIdentifier
    ? CodeGenState.currentParameters.get(argIdentifier)
    : undefined;
  const isCallbackPromotedParam = paramInfo?.forcePointerSemantics ?? false;

  // If target expects a pointer and argument is a callback-promoted param,
  // use the identifier directly (it's already a pointer matching the typedef)
  if (targetParam?.baseType?.endsWith("*") && isCallbackPromotedParam) {
    return wrapWithCppEnumCast(
      argIdentifier!,
      e,
      targetParam?.baseType,
      orchestrator,
    );
  }

  // Issue #872: Set expectedType for MISRA 7.2 compliance, but suppress bare enum resolution
  // (bare enums in function args was never allowed - changing that requires ADR approval)
  const argCode = CodeGenState.withExpectedType(
    targetParam?.baseType,
    () => orchestrator.generateExpression(e),
    true, // suppressEnumResolution
  );

  // Issue #322: Check if parameter expects a pointer and argument is a struct
  if (!targetParam?.baseType?.endsWith("*")) {
    return wrapWithCppEnumCast(argCode, e, targetParam?.baseType, orchestrator);
  }

  // Try getExpressionType first
  let argType = orchestrator.getExpressionType(e);

  // Issue #322: If getExpressionType returns null (e.g., for this.member),
  // fall back to looking up the generated code in the type registry
  let isPointerVariable = false;
  const typeInfo = CodeGenState.getVariableTypeInfo(argCode);
  if (!argType && !argCode.startsWith("&")) {
    if (typeInfo) {
      argType = typeInfo.baseType;
    }
  }
  // Issue #895 Bug B: Check if variable was inferred as a pointer
  if (typeInfo?.isPointer) {
    isPointerVariable = true;
  }

  // Add & if argument needs address-of to match parameter type.
  // Issue #322: struct types passed to pointer params.
  // Issue #832: typedef'd pointer types (e.g., handle_t passed to handle_t*).
  // Issue #895 Bug B: Skip address-of for variables that are already pointers
  const needsAddressOf =
    argType &&
    !argType.endsWith("*") &&
    !argCode.startsWith("&") &&
    !targetParam.isArray &&
    !isPointerVariable &&
    (orchestrator.isStructType(argType) ||
      _parameterExpectsAddressOf(targetParam.baseType, argType, orchestrator));

  const finalArgCode = needsAddressOf ? `&${argCode}` : argCode;

  return wrapWithCppEnumCast(
    finalArgCode,
    e,
    targetParam?.baseType,
    orchestrator,
  );
};

/**
 * Determine if a C-Next parameter should be passed by value.
 */
const _shouldPassByValue = (
  funcExpr: string,
  idx: number,
  targetParam: IResolvedParam["param"],
  isCrossFile: boolean,
  orchestrator: IOrchestrator,
): boolean => {
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
    !orchestrator.isStructType(targetParam.baseType) &&
    !CallExprUtils.isStringType(targetParam.baseType);

  // Issue #551: Unknown types (external enums, typedefs) use pass-by-value
  const isUnknownType =
    !orchestrator.isStructType(targetParam.baseType) &&
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
};

/**
 * Generate C code for a function call.
 *
 * @param funcExpr - The function name or expression being called
 * @param argCtx - The argument list context (null for empty calls)
 * @param input - Generator input (type registry, function signatures, etc.)
 * @param _state - Generator state (unused but part of signature)
 * @param orchestrator - Orchestrator for callbacks into CodeGenerator
 * @returns Generated code and effects
 */
const generateFunctionCall = (
  funcExpr: string,
  argCtx: ArgumentListContext | null,
  input: IGeneratorInput,
  _state: IGeneratorState,
  orchestrator: IOrchestrator,
): IGeneratorOutput => {
  const effects: TGeneratorEffect[] = [];

  // Empty function call
  if (!argCtx) {
    return { code: `${funcExpr}()`, effects };
  }

  const argExprs = argCtx.expression();

  // Check if this is a C-Next function (uses pass-by-reference)
  const isCNextFunc = orchestrator.isCNextFunction(funcExpr);

  // ADR-051: Handle safe_div() and safe_mod() built-in functions
  if (funcExpr === "safe_div" || funcExpr === "safe_mod") {
    return generateSafeDivMod(funcExpr, argExprs, input, orchestrator, effects);
  }

  // Regular function call handling
  // ADR-013: Check const-to-non-const before generating arguments
  if (isCNextFunc) {
    validateConstToNonConst(funcExpr, argExprs, input, orchestrator);
    // Issue #268: Track pass-through modifications for auto-const
    trackPassThroughModifications(funcExpr, argExprs, orchestrator);
  }

  // Get function signature once for all arguments
  const sig = input.functionSignatures.get(funcExpr);

  const args = argExprs
    .map((e, idx) => {
      // Get parameter type info from local signature or cross-file SymbolTable
      const resolved = CallExprUtils.resolveTargetParam(
        sig,
        idx,
        funcExpr,
        input.symbolTable,
      );
      const targetParam = resolved.param;

      // C/C++ function: use pass-by-value semantics
      if (!isCNextFunc) {
        return _generateCFunctionArg(e, targetParam, input, orchestrator);
      }

      // C-Next function: check if target parameter should be passed by value
      if (
        _shouldPassByValue(
          funcExpr,
          idx,
          targetParam,
          resolved.isCrossFile,
          orchestrator,
        )
      ) {
        // Issue #872: Set expectedType for MISRA 7.2 compliance, but suppress bare enum resolution
        const argCode = CodeGenState.withExpectedType(
          targetParam?.baseType,
          () => orchestrator.generateExpression(e),
          true, // suppressEnumResolution
        );
        return wrapWithCppEnumCast(
          argCode,
          e,
          targetParam?.baseType,
          orchestrator,
        );
      }

      // Target parameter is pass-by-reference: use & logic
      return orchestrator.generateFunctionArg(e, targetParam?.baseType);
    })
    .join(", ");

  return { code: `${funcExpr}(${args})`, effects };
};

/**
 * Generate code for safe_div() or safe_mod() built-in functions (ADR-051).
 *
 * These functions take 4 arguments:
 * - output: Variable to store result (passed by reference)
 * - numerator: The dividend
 * - divisor: The divisor
 * - defaultValue: Value to use if divisor is 0
 */
const generateSafeDivMod = (
  funcName: string,
  argExprs: ExpressionContext[],
  input: IGeneratorInput,
  orchestrator: IOrchestrator,
  effects: TGeneratorEffect[],
): IGeneratorOutput => {
  if (argExprs.length !== 4) {
    throw new Error(
      `${funcName} requires exactly 4 arguments: output, numerator, divisor, defaultValue`,
    );
  }

  // Get the output parameter (first argument) to determine type
  const outputArgId = orchestrator.getSimpleIdentifier(argExprs[0]);
  if (!outputArgId) {
    throw new Error(
      `${funcName} requires a variable as the first argument (output parameter)`,
    );
  }

  // Look up the type of the output parameter
  const typeInfo = CodeGenState.getVariableTypeInfo(outputArgId);
  if (!typeInfo) {
    throw new Error(
      `Cannot determine type of output parameter '${outputArgId}' for ${funcName}`,
    );
  }

  // Map C-Next type to helper function suffix
  const cnxType = typeInfo.baseType;
  if (!cnxType) {
    throw new Error(
      `Output parameter '${outputArgId}' has no C-Next type for ${funcName}`,
    );
  }

  // Generate arguments: &output, numerator, divisor, defaultValue
  const outputArg = `&${orchestrator.generateExpression(argExprs[0])}`;
  const numeratorArg = orchestrator.generateExpression(argExprs[1]);
  const divisorArg = orchestrator.generateExpression(argExprs[2]);
  const defaultArg = orchestrator.generateExpression(argExprs[3]);

  const helperName = CallExprUtils.generateSafeDivModHelperName(
    funcName as "safe_div" | "safe_mod",
    cnxType,
  );

  // Track that this operation is used for helper generation
  const opType: "div" | "mod" = funcName === "safe_div" ? "div" : "mod";
  effects.push({ type: "safe-div", operation: opType, cnxType });

  return {
    code: `${helperName}(${outputArg}, ${numeratorArg}, ${divisorArg}, ${defaultArg})`,
    effects,
  };
};

/**
 * Validate const-to-non-const parameter passing (ADR-013).
 *
 * Throws an error if a const value is passed to a non-const parameter.
 */
const validateConstToNonConst = (
  funcName: string,
  argExprs: ExpressionContext[],
  input: IGeneratorInput,
  orchestrator: IOrchestrator,
): void => {
  const sig = input.functionSignatures.get(funcName);
  if (!sig) return;

  for (
    let argIdx = 0;
    argIdx < argExprs.length && argIdx < sig.parameters.length;
    argIdx++
  ) {
    const argId = orchestrator.getSimpleIdentifier(argExprs[argIdx]);
    if (argId && orchestrator.isConstValue(argId)) {
      const param = sig.parameters[argIdx];
      if (!param.isConst) {
        throw new Error(
          `cannot pass const '${argId}' to non-const parameter '${param.name}' ` +
            `of function '${funcName}'`,
        );
      }
    }
  }
};

/**
 * Issue #268: Track pass-through modifications for auto-const inference.
 *
 * When a parameter of the current function is passed to another function
 * that modifies its corresponding parameter, we must mark our parameter
 * as modified too (since it's pass-by-reference).
 *
 * Example:
 *   void modifies(u32 val) { val <- 42; }
 *   void passesThrough(u32 val) { modifies(val); }  // val is effectively modified
 *
 * Note: This only works when the callee is defined before the caller.
 * If the callee is defined later, we can't know if it modifies the param,
 * and the C compiler will catch any const-mismatch errors.
 */
const trackPassThroughModifications = (
  funcName: string,
  argExprs: ExpressionContext[],
  orchestrator: IOrchestrator,
): void => {
  for (let argIdx = 0; argIdx < argExprs.length; argIdx++) {
    const argId = orchestrator.getSimpleIdentifier(argExprs[argIdx]);
    if (!argId) continue;

    // Check if this argument is a parameter of the current function
    if (!orchestrator.isCurrentParameter(argId)) continue;

    // Check if the callee's parameter at this index is modified
    if (orchestrator.isCalleeParameterModified(funcName, argIdx)) {
      // The callee modifies this parameter, so our parameter is also modified
      orchestrator.markParameterModified(argId);
    }
  }
};

export default generateFunctionCall;
