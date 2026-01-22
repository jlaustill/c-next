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
} from "../../../parser/grammar/CNextParser";
import IGeneratorOutput from "../IGeneratorOutput";
import TGeneratorEffect from "../TGeneratorEffect";
import IGeneratorInput from "../IGeneratorInput";
import IGeneratorState from "../IGeneratorState";
import IOrchestrator from "../IOrchestrator";
import ESymbolKind from "../../../types/ESymbolKind";

/**
 * Issue #304: Map C-Next type to C type for static_cast.
 */
const TYPE_MAP: Record<string, string> = {
  u8: "uint8_t",
  u16: "uint16_t",
  u32: "uint32_t",
  u64: "uint64_t",
  i8: "int8_t",
  i16: "int16_t",
  i32: "int32_t",
  i64: "int64_t",
  f32: "float",
  f64: "double",
  bool: "bool",
};

const mapTypeToCType = (cnxType: string): string => {
  return TYPE_MAP[cnxType] || cnxType;
};

/**
 * Issue #315: Small primitive types that are always passed by value.
 * These match the types used in Issue #269 for pass-by-value optimization.
 * For cross-file function calls, we use these types directly since we can't
 * know if the parameter is modified (that info is only in the source file).
 */
const SMALL_PRIMITIVE_TYPES = new Set(["u8", "u16", "i8", "i16", "bool"]);

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
      const cType = mapTypeToCType(targetParamBaseType);
      return `static_cast<${cType}>(${argCode})`;
    }
  }

  return argCode;
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

  const args = argExprs
    .map((e, idx) => {
      // Get function signature for parameter type info
      const sig = input.functionSignatures.get(funcExpr);
      let targetParam = sig?.parameters[idx];
      // Issue #315: Track if we got param info from SymbolTable (cross-file function)
      let isCrossFileFunction = false;

      // Issue #315: If no local signature, try SymbolTable for cross-file functions
      if (!targetParam && input.symbolTable) {
        const symbols = input.symbolTable.getOverloads(funcExpr);
        for (const sym of symbols) {
          if (sym.kind === ESymbolKind.Function && sym.parameters?.[idx]) {
            // Map symbol parameter to targetParam format (IFunctionSignature.parameters)
            targetParam = {
              name: sym.parameters[idx].name,
              baseType: sym.parameters[idx].type,
              isConst: sym.parameters[idx].isConst,
              isArray: sym.parameters[idx].isArray,
            };
            isCrossFileFunction = true;
            break;
          }
        }
      }

      if (!isCNextFunc) {
        // C/C++ function: pass-by-value, just generate the expression
        let argCode = orchestrator.generateExpression(e);

        // Issue #322: Check if parameter expects a pointer and argument is a struct
        // If so, automatically add & to pass the address
        if (targetParam?.baseType?.endsWith("*")) {
          // Try getExpressionType first
          let argType = orchestrator.getExpressionType(e);

          // Issue #322: If getExpressionType returns null (e.g., for this.member),
          // fall back to looking up the generated code in the type registry
          if (!argType && !argCode.startsWith("&")) {
            // The argCode is already resolved (e.g., ConfigManager_config)
            // Look it up directly in the type registry
            const typeInfo = input.typeRegistry.get(argCode);
            if (typeInfo) {
              argType = typeInfo.baseType;
            }
          }

          // Add & if argument is a struct type (not already a pointer)
          // Don't add & if the expression already has & prefix
          // Don't add & if argument is already a pointer or array
          if (
            argType &&
            !argType.endsWith("*") &&
            !argCode.startsWith("&") &&
            !targetParam.isArray &&
            orchestrator.isStructType(argType)
          ) {
            argCode = `&${argCode}`;
          }
        }

        // Issue #304: Wrap with static_cast if C++ enum class → integer
        return wrapWithCppEnumCast(
          argCode,
          e,
          targetParam?.baseType,
          orchestrator,
        );
      }

      // C-Next function: check if target parameter is a pass-by-value type
      const isFloatParam =
        targetParam && orchestrator.isFloatType(targetParam.baseType);
      const isEnumParam =
        targetParam && orchestrator.getKnownEnums().has(targetParam.baseType);
      // Issue #269: Check if small unmodified primitive (for local functions)
      const isPrimitivePassByValue = orchestrator.isParameterPassByValue(
        funcExpr,
        idx,
      );
      // Issue #315: For cross-file functions ONLY, check if it's a small primitive type
      // that should always be passed by value (u8, u16, i8, i16, bool).
      // We only do this for cross-file functions because for local functions,
      // isPrimitivePassByValue correctly considers whether the parameter is modified.
      const isSmallPrimitive =
        isCrossFileFunction &&
        targetParam &&
        SMALL_PRIMITIVE_TYPES.has(targetParam.baseType);

      if (
        isFloatParam ||
        isEnumParam ||
        isPrimitivePassByValue ||
        isSmallPrimitive
      ) {
        // Target parameter is pass-by-value: pass value directly
        const argCode = orchestrator.generateExpression(e);
        // Issue #304: Wrap with static_cast if C++ enum class → integer
        return wrapWithCppEnumCast(
          argCode,
          e,
          targetParam?.baseType,
          orchestrator,
        );
      } else {
        // Target parameter is pass-by-reference: use & logic
        // Pass the target param type for proper literal handling
        return orchestrator.generateFunctionArg(e, targetParam?.baseType);
      }
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

  const helperName =
    funcName === "safe_div"
      ? `cnx_safe_div_${cnxType}`
      : `cnx_safe_mod_${cnxType}`;

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
