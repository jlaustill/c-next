/**
 * Function Call Expression Generator
 *
 * Generates C code for function calls:
 * - safe_div/safe_mod built-in functions (ADR-051)
 * - C-Next function calls with pass-by-reference semantics
 * - C function calls with pass-by-value semantics
 * - Const-to-non-const validation (ADR-013)
 *
 * #1445 box 3: takes `IPlannedCallArgument[]`, not nodes. It asked an argument
 * node four things -- is it a bare identifier, what type is it, render it,
 * render it by reference -- and three of those are deferred because exactly
 * ONE render may happen per argument. See `IPlannedCallArgument`.
 */
import invariant from "../../../../../utils/invariant";
import IGeneratorOutput from "../IGeneratorOutput";
import TGeneratorEffect from "../TGeneratorEffect";
import IGeneratorInput from "../IGeneratorInput";
import IGeneratorState from "../IGeneratorState";
import IOrchestrator from "../IOrchestrator";
import CallExprUtils from "./CallExprUtils";
import CodeGenState from "../../../../../transpiler/state/CodeGenState";
import C_TYPE_WIDTH from "../../types/C_TYPE_WIDTH";
import type IPlannedCallArgument from "../../types/IPlannedCallArgument";

/**
 * Issue #304: Wrap argument with static_cast if it's a C++ enum class
 * being passed to an integer parameter.
 *
 * @param argCode - The generated argument code
 * @param arg - The planned argument (for its type)
 * @param targetParamBaseType - The target parameter's base type (if known)
 * @param orchestrator - Orchestrator for type checking methods
 * @returns The argument code, possibly wrapped with static_cast
 */
const wrapWithCppEnumCast = (
  argCode: string,
  arg: IPlannedCallArgument,
  targetParamBaseType: string | undefined,
  orchestrator: IOrchestrator,
): string => {
  if (!orchestrator.isCppMode() || !targetParamBaseType) {
    return argCode;
  }

  const argType = arg.expressionType();
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
 * Resolve an argument expression's C-Next type for the address-of decision.
 * Prefers the expression type, then the codegen variable registry, then the C
 * symbol table — the last covers extern C globals (e.g. an lvgl font
 * `lv_font_montserrat_32` of type `lv_font_t`, Issue #985) whose type only
 * header symbol collection knows. Returns null when the type can't be resolved
 * or the argument is already an address-of expression.
 */
const _resolveArgType = (
  arg: IPlannedCallArgument,
  argCode: string,
  typeInfoBaseType: string | undefined,
): string | null => {
  const exprType = arg.expressionType();
  if (exprType) return exprType;
  if (argCode.startsWith("&")) return null;
  if (typeInfoBaseType) return typeInfoBaseType;
  const cSymbol = CodeGenState.symbolTable?.getCSymbol(argCode);
  if (cSymbol?.kind === "variable" && !cSymbol.isArray) return cSymbol.type;
  return null;
};

/**
 * Generate argument code for a C/C++ function call.
 * Handles automatic address-of (&) for struct arguments passed to pointer params.
 * Issue #872: Sets expectedType for MISRA 7.2 U suffix on unsigned literals.
 */
const _generateCFunctionArg = (
  arg: IPlannedCallArgument,
  targetParam: IResolvedParam["param"],
  orchestrator: IOrchestrator,
): string => {
  // Issue #937: Check if argument is a callback-promoted parameter (already a pointer)
  // BEFORE generating the expression. If target expects a pointer and we have a
  // callback-promoted param, use the identifier directly instead of dereferencing.
  const argIdentifier = arg.simpleIdentifier;
  const paramInfo = argIdentifier
    ? CodeGenState.currentParameters.get(argIdentifier)
    : undefined;
  const isCallbackPromotedParam = paramInfo?.forcePointerSemantics ?? false;

  // If target expects a pointer and argument is a callback-promoted param,
  // use the identifier directly (it's already a pointer matching the typedef)
  if (targetParam?.baseType?.endsWith("*") && isCallbackPromotedParam) {
    // `argIdentifier` is non-null here only because `isCallbackPromotedParam`
    // implies it -- `paramInfo` is undefined without it. That coupling is the
    // assertion's only guard.
    return wrapWithCppEnumCast(
      argIdentifier!,
      arg,
      targetParam?.baseType,
      orchestrator,
    );
  }

  // Issue #872: Set expectedType for MISRA 7.2 compliance, but suppress bare enum resolution
  // (bare enums in function args was never allowed - changing that requires ADR approval)
  const argCode = orchestrator.state.withExpectedType(
    targetParam?.baseType,
    arg.render,
    true, // suppressEnumResolution
  );

  // Issue #322: Check if parameter expects a pointer and argument is a struct
  if (!targetParam?.baseType?.endsWith("*")) {
    return wrapWithCppEnumCast(
      argCode,
      arg,
      targetParam?.baseType,
      orchestrator,
    );
  }

  // Resolve the argument's type (expression type → variable registry → C symbol
  // table for extern globals) to decide whether it needs address-of.
  const typeInfo = CodeGenState.getVariableTypeInfo(argCode);
  const argType = _resolveArgType(arg, argCode, typeInfo?.baseType);
  // Issue #895 Bug B: a variable already inferred as a pointer must not get `&`.
  const isPointerVariable = typeInfo?.isPointer ?? false;

  // Issue #948: Check if argument is an opaque scope variable (already a pointer)
  // Issue #996: ...including an element of an opaque-handle array (arr[i])
  const isOpaqueScopeVar =
    orchestrator.state.isOpaqueScopeVariableAccess(argCode);

  // Add & if argument needs address-of to match parameter type.
  // Issue #322: struct types passed to pointer params.
  // Issue #832: typedef'd pointer types (e.g., handle_t passed to handle_t*).
  // Issue #895 Bug B: Skip address-of for variables that are already pointers
  // Issue #948: Skip address-of for opaque scope variables (already pointers)
  const needsAddressOf =
    argType &&
    !argType.endsWith("*") &&
    !argCode.startsWith("&") &&
    !targetParam.isArray &&
    !isPointerVariable &&
    !isOpaqueScopeVar &&
    (orchestrator.isStructType(argType) ||
      _parameterExpectsAddressOf(targetParam.baseType, argType, orchestrator));

  const finalArgCode = needsAddressOf ? `&${argCode}` : argCode;

  return wrapWithCppEnumCast(
    finalArgCode,
    arg,
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
 * @param args - The planned arguments (null when the call declares none)
 * @param input - Generator input (type registry, function signatures, etc.)
 * @param _state - Generator state (unused but part of signature)
 * @param orchestrator - Orchestrator for callbacks into CodeGenerator
 * @returns Generated code and effects
 */
const generateFunctionCall = (
  funcExpr: string,
  args: readonly IPlannedCallArgument[] | null,
  input: IGeneratorInput,
  _state: IGeneratorState,
  orchestrator: IOrchestrator,
): IGeneratorOutput => {
  const effects: TGeneratorEffect[] = [];

  // Empty function call. This test stays FIRST: a `safe_div` written with no
  // argument list emits `safe_div()` here, BEFORE the four-argument invariant
  // below can fire.
  if (!args) {
    return { code: `${funcExpr}()`, effects };
  }

  // Check if this is a C-Next function (uses pass-by-reference)
  const isCNextFunc = orchestrator.isCNextFunction(funcExpr);

  // ADR-051: Handle safe_div() and safe_mod() built-in functions
  if (funcExpr === "safe_div" || funcExpr === "safe_mod") {
    return generateSafeDivMod(funcExpr, args, effects);
  }

  // Regular function call handling
  // #1322: a const argument to a non-const parameter is E0878 in pass 2.1.
  if (isCNextFunc) {
    // Issue #268: Track pass-through modifications for auto-const. Runs BEFORE
    // any argument renders, and mutates auto-const state -- it must not be
    // folded into the map below.
    trackPassThroughModifications(funcExpr, args, orchestrator);
  }

  // Get function signature once for all arguments
  const sig = input.functionSignatures.get(funcExpr);

  // Issue #992: Clear inDeclarationInit for function call arguments — struct
  // initializers inside function args need compound literals, not plain designated initializers.
  const rendered = orchestrator.state.withoutDeclarationInit(() =>
    args
      .map((arg, idx) => {
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
          return _generateCFunctionArg(arg, targetParam, orchestrator);
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
          const argCode = orchestrator.state.withExpectedType(
            targetParam?.baseType,
            arg.render,
            true, // suppressEnumResolution
          );
          return wrapWithCppEnumCast(
            argCode,
            arg,
            targetParam?.baseType,
            orchestrator,
          );
        }

        // Target parameter is pass-by-reference: use & logic
        return arg.renderByReference(targetParam?.baseType);
      })
      .join(", "),
  );

  return { code: `${funcExpr}(${rendered})`, effects };
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
  args: readonly IPlannedCallArgument[],
  effects: TGeneratorEffect[],
): IGeneratorOutput => {
  // #1322: ADR-051's call shape is E0884 (four arguments) and E0885 (the first
  // is a variable to receive the result) in pass 2.1, and a `const` output is
  // E0877 there -- that last one was accepted here and emitted `&K` into a
  // non-const pointer parameter.
  invariant(
    args.length === 4,
    `${funcName} takes four arguments -- E0884 rejects this in pass 2.1, before this runs`,
  );

  // Get the output parameter (first argument) to determine type
  const outputArgId = args[0].simpleIdentifier;
  invariant(
    outputArgId,
    `${funcName}'s first argument is a variable -- E0885 rejects this in pass 2.1, before this runs`,
  );

  // Look up the type of the output parameter
  const typeInfo = CodeGenState.getVariableTypeInfo(outputArgId);
  invariant(
    typeInfo,
    `${funcName}'s output parameter is a declared variable with a type -- E0885 rejects this in pass 2.1, before this runs`,
  );

  // Map C-Next type to helper function suffix
  const cnxType = typeInfo.baseType;
  invariant(
    cnxType,
    `a registered variable always has a non-empty baseType (output parameter '${outputArgId}' of ${funcName})`,
  );

  // Generate arguments: &output, numerator, divisor, defaultValue
  // These four render OUTSIDE `withoutDeclarationInit`, because the early
  // return above precedes that scope. Every other route renders inside it.
  const outputArg = `&${args[0].render()}`;
  const numeratorArg = args[1].render();
  const divisorArg = args[2].render();
  const defaultArg = args[3].render();

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
  args: readonly IPlannedCallArgument[],
  orchestrator: IOrchestrator,
): void => {
  for (let argIdx = 0; argIdx < args.length; argIdx++) {
    const argId = args[argIdx].simpleIdentifier;
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
