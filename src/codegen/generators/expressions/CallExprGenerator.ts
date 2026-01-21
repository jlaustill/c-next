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
      const targetParam = sig?.parameters[idx];

      if (!isCNextFunc) {
        // C function: pass-by-value, just generate the expression
        const argCode = orchestrator.generateExpression(e);

        // Issue #304: In C++ mode, C++ enum classes need explicit cast to integer types
        if (orchestrator.isCppMode() && targetParam) {
          const argType = orchestrator.getExpressionType(e);
          if (argType && orchestrator.isCppEnumClass(argType)) {
            // Target is an integer type - wrap with static_cast
            if (orchestrator.isIntegerType(targetParam.baseType)) {
              const cType = mapTypeToCType(targetParam.baseType);
              return `static_cast<${cType}>(${argCode})`;
            }
          }
        }

        return argCode;
      }

      // C-Next function: check if target parameter is a pass-by-value type
      const isFloatParam =
        targetParam && orchestrator.isFloatType(targetParam.baseType);
      const isEnumParam =
        targetParam && orchestrator.getKnownEnums().has(targetParam.baseType);
      // Issue #269: Check if small unmodified primitive
      const isPrimitivePassByValue = orchestrator.isParameterPassByValue(
        funcExpr,
        idx,
      );

      if (isFloatParam || isEnumParam || isPrimitivePassByValue) {
        // Target parameter is pass-by-value: pass value directly
        const argCode = orchestrator.generateExpression(e);

        // Issue #304: In C++ mode, C++ enum classes need explicit cast to integer types
        if (orchestrator.isCppMode() && targetParam) {
          const argType = orchestrator.getExpressionType(e);
          if (argType && orchestrator.isCppEnumClass(argType)) {
            // Target is an integer type - wrap with static_cast
            if (orchestrator.isIntegerType(targetParam.baseType)) {
              const cType = mapTypeToCType(targetParam.baseType);
              return `static_cast<${cType}>(${argCode})`;
            }
          }
        }

        return argCode;
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
