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
 * Generate argument code for a C/C++ function call.
 * Handles automatic address-of (&) for struct arguments passed to pointer params.
 */
const _generateCFunctionArg = (
  e: ExpressionContext,
  targetParam: IResolvedParam["param"],
  input: IGeneratorInput,
  orchestrator: IOrchestrator,
): string => {
  let argCode = orchestrator.generateExpression(e);

  // Issue #322: Check if parameter expects a pointer and argument is a struct
  if (!targetParam?.baseType?.endsWith("*")) {
    return wrapWithCppEnumCast(argCode, e, targetParam?.baseType, orchestrator);
  }

  // Try getExpressionType first
  let argType = orchestrator.getExpressionType(e);

  // Issue #322: If getExpressionType returns null (e.g., for this.member),
  // fall back to looking up the generated code in the type registry
  if (!argType && !argCode.startsWith("&")) {
    const typeInfo = input.typeRegistry.get(argCode);
    if (typeInfo) {
      argType = typeInfo.baseType;
    }
  }

  // Add & if argument is a struct type (not already a pointer)
  const needsAddressOf =
    argType &&
    !argType.endsWith("*") &&
    !argCode.startsWith("&") &&
    !targetParam.isArray &&
    orchestrator.isStructType(argType);

  if (needsAddressOf) {
    argCode = `&${argCode}`;
  }

  return wrapWithCppEnumCast(argCode, e, targetParam?.baseType, orchestrator);
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
  const isSmallPrimitive =
    isCrossFile && CallExprUtils.isSmallPrimitiveType(targetParam.baseType);

  // Issue #551: Unknown types (external enums, typedefs) use pass-by-value
  const isUnknownType =
    !orchestrator.isStructType(targetParam.baseType) &&
    !CallExprUtils.isKnownPrimitiveType(targetParam.baseType) &&
    !CallExprUtils.isStringType(targetParam.baseType) &&
    !isFloatParam &&
    !isEnumParam &&
    !isSmallPrimitive;

  return (
    isFloatParam ||
    isEnumParam ||
    isPrimitivePassByValue ||
    isSmallPrimitive ||
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
        const argCode = orchestrator.generateExpression(e);
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
  const typeInfo = input.typeRegistry.get(outputArgId);
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
