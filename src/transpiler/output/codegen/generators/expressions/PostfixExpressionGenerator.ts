/**
 * Postfix Expression Generator (Issue #644)
 *
 * Handles postfix expressions including:
 * - Member access (obj.field)
 * - Array subscripts (arr[i])
 * - Bit access (value[3] or value[0, 8])
 * - Function calls (func())
 * - Property access (.length, .capacity, .size)
 *
 * This generator was extracted from CodeGenerator._generatePostfixExpr
 * to reduce the size and complexity of CodeGenerator.ts.
 */
import * as Parser from "../../../../logic/parser/grammar/CNextParser";
import IGeneratorOutput from "../IGeneratorOutput";
import TGeneratorEffect from "../TGeneratorEffect";
import IGeneratorInput from "../IGeneratorInput";
import IGeneratorState from "../IGeneratorState";
import IOrchestrator from "../IOrchestrator";
import accessGenerators from "./AccessExprGenerator";
import generateFunctionCall from "./CallExprGenerator";
import memberAccessChain from "../../memberAccessChain";
import TypeCheckUtils from "../../../../../utils/TypeCheckUtils";
import SubscriptClassifier from "../../subscript/SubscriptClassifier";
import TYPE_WIDTH from "../../types/TYPE_WIDTH";
import C_TYPE_WIDTH from "../../types/C_TYPE_WIDTH";

/**
 * Generate C code for a postfix expression.
 *
 * A postfix expression consists of a primary expression followed by
 * zero or more postfix operations (member access, subscripts, function calls).
 *
 * @param ctx - The postfix expression context
 * @param input - Generator input (type registry, symbols, etc.)
 * @param state - Generator state (current scope, parameters, etc.)
 * @param orchestrator - Orchestrator for callbacks into CodeGenerator
 * @returns Generated code and effects
 */
const generatePostfixExpression = (
  ctx: Parser.PostfixExpressionContext,
  input: IGeneratorInput,
  state: IGeneratorState,
  orchestrator: IOrchestrator,
): IGeneratorOutput => {
  const effects: TGeneratorEffect[] = [];

  const primary = ctx.primaryExpression();
  const ops = ctx.postfixOp();

  // Check if this is a struct parameter - we may need to handle -> access
  const primaryId = primary.IDENTIFIER()?.getText();
  const paramInfo = primaryId ? state.currentParameters.get(primaryId) : null;
  const isStructParam = paramInfo?.isStruct ?? false;

  // Issue #579: Check if we have subscript access on a non-array parameter
  const hasSubscriptOps = ops.some((op) => op.expression().length > 0);
  const isNonArrayParamWithSubscript =
    paramInfo && !paramInfo.isArray && !paramInfo.isStruct && hasSubscriptOps;

  let result: string;
  if (isNonArrayParamWithSubscript) {
    result = primaryId!;
  } else {
    result = orchestrator.generatePrimaryExpr(primary);
  }

  // ADR-016: Track if we've encountered a register in the access chain
  let isRegisterChain = primaryId
    ? input.symbols!.knownRegisters.has(primaryId)
    : false;

  // Track if current member is an array through member access chain
  let currentMemberIsArray = false;
  const primaryBaseType = primaryId
    ? input.typeRegistry.get(primaryId)?.baseType
    : undefined;
  let currentStructType =
    primaryBaseType && orchestrator.isKnownStruct(primaryBaseType)
      ? primaryBaseType
      : undefined;

  // Track previous struct type and member name for .length on struct members
  let previousStructType: string | undefined = undefined;
  let previousMemberName: string | undefined = undefined;

  // Track the current resolved identifier for type lookups
  let currentIdentifier = primaryId;

  // Bug #8: Track remaining array dimensions for multi-dimensional arrays
  const primaryTypeInfo = primaryId
    ? input.typeRegistry.get(primaryId)
    : undefined;
  const primaryParamInfo = primaryId
    ? state.currentParameters.get(primaryId)
    : undefined;
  let remainingArrayDims =
    primaryTypeInfo?.arrayDimensions?.length ??
    (primaryParamInfo?.isArray ? 1 : 0);
  let subscriptDepth = 0;
  let isGlobalAccess = false;
  let isCppAccessChain = false;

  // Issue #516: Initialize isCppAccessChain based on primary identifier
  if (primaryId && orchestrator.isCppScopeSymbol(primaryId)) {
    isCppAccessChain = true;
  }

  for (const op of ops) {
    // Member access
    if (op.IDENTIFIER()) {
      const memberName = op.IDENTIFIER()!.getText();

      // ADR-016: Handle global. prefix
      if (result === "__GLOBAL_PREFIX__") {
        result = memberName;
        currentIdentifier = memberName;
        isGlobalAccess = true;

        // ADR-057: Check if global variable would be shadowed by a local
        if (state.localVariables.has(memberName)) {
          throw new Error(
            `Error: Cannot use 'global.${memberName}' when local variable '${memberName}' shadows it. ` +
              `Rename the local variable to avoid shadowing.`,
          );
        }

        if (orchestrator.isCppScopeSymbol(memberName)) {
          isCppAccessChain = true;
        }
        if (input.symbols!.knownRegisters.has(memberName)) {
          isRegisterChain = true;
        }

        // Issue #612: Set currentStructType for global struct variables
        // This enables correct array vs bit access classification for struct members
        const globalTypeInfo = input.typeRegistry.get(memberName);
        if (
          globalTypeInfo &&
          orchestrator.isKnownStruct(globalTypeInfo.baseType)
        ) {
          currentStructType = globalTypeInfo.baseType;
        }

        continue;
      }

      // Issue #212: Check if 'length' is a scope variable before treating it as property
      if (result === "__THIS_SCOPE__" && memberName === "length") {
        if (!state.currentScope) {
          throw new Error("Error: 'this' can only be used inside a scope");
        }
        const members = state.scopeMembers.get(state.currentScope);
        if (members?.has("length")) {
          result = `${state.currentScope}_${memberName}`;
          currentIdentifier = result;
          const resolvedTypeInfo = input.typeRegistry.get(result);
          if (
            resolvedTypeInfo &&
            orchestrator.isKnownStruct(resolvedTypeInfo.baseType)
          ) {
            currentStructType = resolvedTypeInfo.baseType;
          }
          continue;
        }
      }

      // Handle .length property
      if (memberName === "length") {
        const lengthResult = generateLengthProperty(
          result,
          primaryId,
          currentIdentifier,
          previousStructType,
          previousMemberName,
          subscriptDepth,
          input,
          state,
          orchestrator,
          effects,
        );
        if (lengthResult !== null) {
          result = lengthResult;
          previousStructType = undefined;
          previousMemberName = undefined;
          continue;
        }
      }

      // Handle .capacity property
      if (memberName === "capacity") {
        const typeInfo = primaryId
          ? input.typeRegistry.get(primaryId)
          : undefined;
        const capResult = accessGenerators.generateCapacityProperty(typeInfo);
        applyAccessEffects(capResult.effects, effects);
        result = capResult.code;
        continue;
      }

      // Handle .size property
      if (memberName === "size") {
        const typeInfo = primaryId
          ? input.typeRegistry.get(primaryId)
          : undefined;
        const sizeResult = accessGenerators.generateSizeProperty(typeInfo);
        applyAccessEffects(sizeResult.effects, effects);
        result = sizeResult.code;
        continue;
      }

      // Handle bitmap field access, scope member access, enum member access, etc.
      const memberResult = generateMemberAccess(
        result,
        memberName,
        primaryId,
        isStructParam,
        isGlobalAccess,
        isCppAccessChain,
        currentStructType,
        currentIdentifier,
        previousStructType,
        previousMemberName,
        isRegisterChain,
        input,
        state,
        orchestrator,
        effects,
      );

      result = memberResult.result;
      currentIdentifier = memberResult.currentIdentifier ?? currentIdentifier;
      currentStructType = memberResult.currentStructType;
      currentMemberIsArray =
        memberResult.currentMemberIsArray ?? currentMemberIsArray;
      isRegisterChain = memberResult.isRegisterChain ?? isRegisterChain;
      isCppAccessChain = memberResult.isCppAccessChain ?? isCppAccessChain;
      previousStructType = memberResult.previousStructType;
      previousMemberName = memberResult.previousMemberName;
    }
    // Array subscript / bit access
    else if (op.expression().length > 0) {
      const subscriptResult = generateSubscriptAccess(
        result,
        op,
        primaryId,
        primaryTypeInfo,
        currentIdentifier,
        currentStructType,
        currentMemberIsArray,
        remainingArrayDims,
        subscriptDepth,
        isRegisterChain,
        input,
        state,
        orchestrator,
        effects,
      );

      result = subscriptResult.result;
      currentStructType = subscriptResult.currentStructType;
      currentMemberIsArray = subscriptResult.currentMemberIsArray ?? false;
      remainingArrayDims =
        subscriptResult.remainingArrayDims ?? remainingArrayDims;
      subscriptDepth = subscriptResult.subscriptDepth ?? subscriptDepth;
    }
    // Function call
    else {
      const callResult = generateFunctionCall(
        result,
        op.argumentList() || null,
        input,
        state,
        orchestrator,
      );
      applyAccessEffects(callResult.effects, effects);
      result = callResult.code;
    }
  }

  // ADR-006: If a struct parameter is used as a whole value (no postfix ops)
  if (isStructParam && ops.length === 0) {
    return {
      code: memberAccessChain.wrapStructParamValue(result, {
        cppMode: orchestrator.isCppMode(),
      }),
      effects,
    };
  }

  return { code: result, effects };
};

/**
 * Generate .length property access.
 * Returns null if not applicable (falls through to member access).
 */
const generateLengthProperty = (
  result: string,
  primaryId: string | undefined,
  currentIdentifier: string | undefined,
  previousStructType: string | undefined,
  previousMemberName: string | undefined,
  subscriptDepth: number,
  input: IGeneratorInput,
  state: IGeneratorState,
  orchestrator: IOrchestrator,
  effects: TGeneratorEffect[],
): string | null => {
  // Special case: main function's args.length -> argc
  if (state.mainArgsName && primaryId === state.mainArgsName) {
    return "argc";
  }

  // Check if we're accessing a struct member (cfg.magic.length)
  if (previousStructType && previousMemberName) {
    const fieldInfo = orchestrator.getStructFieldInfo(
      previousStructType,
      previousMemberName,
    );
    if (fieldInfo) {
      return generateStructFieldLength(
        result,
        fieldInfo,
        subscriptDepth,
        input,
        orchestrator,
        effects,
      );
    }
  }

  // Fall back to checking the current resolved identifier's type
  const typeInfo = currentIdentifier
    ? input.typeRegistry.get(currentIdentifier)
    : undefined;

  if (!typeInfo) {
    return `/* .length: unknown type for ${result} */0`;
  }

  return generateTypeInfoLength(
    result,
    typeInfo,
    subscriptDepth,
    currentIdentifier,
    input,
    state,
    effects,
  );
};

/**
 * Generate .length for a struct field.
 */
const generateStructFieldLength = (
  result: string,
  fieldInfo: { type: string; dimensions?: (number | string)[] },
  subscriptDepth: number,
  input: IGeneratorInput,
  orchestrator: IOrchestrator,
  effects: TGeneratorEffect[],
): string => {
  const memberType = fieldInfo.type;
  const dimensions = fieldInfo.dimensions;
  const isStringField = TypeCheckUtils.isString(memberType);

  if (dimensions && dimensions.length > 1 && isStringField) {
    if (subscriptDepth === 0) {
      return String(dimensions[0]);
    } else {
      effects.push({ type: "include", header: "string" });
      return `strlen(${result})`;
    }
  } else if (dimensions && dimensions.length === 1 && isStringField) {
    effects.push({ type: "include", header: "string" });
    return `strlen(${result})`;
  } else if (
    dimensions &&
    dimensions.length > 0 &&
    subscriptDepth < dimensions.length
  ) {
    return String(dimensions[subscriptDepth]);
  } else if (
    dimensions &&
    dimensions.length > 0 &&
    subscriptDepth >= dimensions.length
  ) {
    return getTypeBitWidth(memberType, input);
  } else {
    return getTypeBitWidth(memberType, input);
  }
};

/**
 * Generate .length from type info.
 */
const generateTypeInfoLength = (
  result: string,
  typeInfo: {
    isString?: boolean;
    isArray?: boolean;
    isEnum?: boolean;
    arrayDimensions?: (number | string)[];
    baseType: string;
    bitWidth?: number;
    isBitmap?: boolean;
    bitmapTypeName?: string;
  },
  subscriptDepth: number,
  currentIdentifier: string | undefined,
  input: IGeneratorInput,
  state: IGeneratorState,
  effects: TGeneratorEffect[],
): string => {
  // ADR-045: String type handling
  if (typeInfo.isString) {
    if (typeInfo.arrayDimensions && typeInfo.arrayDimensions.length > 1) {
      if (subscriptDepth === 0) {
        return String(typeInfo.arrayDimensions[0]);
      } else {
        return `strlen(${result})`;
      }
    } else {
      // Use lengthCache if available for this identifier
      if (currentIdentifier && state.lengthCache?.has(currentIdentifier)) {
        return state.lengthCache.get(currentIdentifier)!;
      }
      return currentIdentifier
        ? `strlen(${currentIdentifier})`
        : `strlen(${result})`;
    }
  } else if (
    typeInfo.isArray &&
    typeInfo.arrayDimensions &&
    typeInfo.arrayDimensions.length > 0 &&
    subscriptDepth < typeInfo.arrayDimensions.length
  ) {
    return String(typeInfo.arrayDimensions[subscriptDepth]);
  } else if (
    typeInfo.isArray &&
    typeInfo.arrayDimensions &&
    typeInfo.arrayDimensions.length > 0 &&
    subscriptDepth >= typeInfo.arrayDimensions.length
  ) {
    if (typeInfo.isEnum) {
      return "32";
    } else if (
      TypeCheckUtils.isString(typeInfo.baseType) ||
      typeInfo.isString
    ) {
      effects.push({ type: "include", header: "string" });
      return `strlen(${result})`;
    } else {
      let elementBitWidth = TYPE_WIDTH[typeInfo.baseType] || 0;
      if (
        elementBitWidth === 0 &&
        typeInfo.isBitmap &&
        typeInfo.bitmapTypeName
      ) {
        elementBitWidth =
          input.symbols!.bitmapBitWidth.get(typeInfo.bitmapTypeName) || 0;
      }
      if (elementBitWidth > 0) {
        return String(elementBitWidth);
      } else {
        return `/* .length: unsupported element type ${typeInfo.baseType} */0`;
      }
    }
  } else if (typeInfo.isArray) {
    return `/* .length unknown for ${currentIdentifier} */0`;
  } else if (typeInfo.isEnum) {
    return "32";
  } else {
    return String(typeInfo.bitWidth || 0);
  }
};

/**
 * Get bit width for a type.
 */
const getTypeBitWidth = (typeName: string, input: IGeneratorInput): string => {
  let bitWidth = TYPE_WIDTH[typeName] || C_TYPE_WIDTH[typeName] || 0;
  if (bitWidth === 0 && input.symbolTable) {
    const enumWidth = input.symbolTable.getEnumBitWidth(typeName);
    if (enumWidth) bitWidth = enumWidth;
  }
  if (bitWidth > 0) {
    return String(bitWidth);
  } else {
    return `/* .length: unsupported type ${typeName} */0`;
  }
};

/**
 * Member access result.
 */
interface MemberAccessResult {
  result: string;
  currentIdentifier?: string;
  currentStructType?: string;
  currentMemberIsArray?: boolean;
  isRegisterChain?: boolean;
  isCppAccessChain?: boolean;
  previousStructType?: string;
  previousMemberName?: string;
}

/**
 * Generate member access (obj.field).
 * This is a simplified version - full implementation delegates to CodeGenerator.
 */
const generateMemberAccess = (
  result: string,
  memberName: string,
  primaryId: string | undefined,
  isStructParam: boolean,
  isGlobalAccess: boolean,
  isCppAccessChain: boolean,
  currentStructType: string | undefined,
  currentIdentifier: string | undefined,
  previousStructType: string | undefined,
  previousMemberName: string | undefined,
  isRegisterChain: boolean,
  input: IGeneratorInput,
  state: IGeneratorState,
  orchestrator: IOrchestrator,
  effects: TGeneratorEffect[],
): MemberAccessResult => {
  // This is a placeholder - the full implementation is complex and will be
  // migrated incrementally. For now, delegate back to CodeGenerator via
  // orchestrator methods where needed.

  const output: MemberAccessResult = {
    result,
    currentIdentifier,
    currentStructType,
    currentMemberIsArray: false,
    isRegisterChain,
    isCppAccessChain,
    previousStructType: currentStructType,
    previousMemberName: memberName,
  };

  // Check for bitmap field access
  if (primaryId) {
    const typeInfo = input.typeRegistry.get(primaryId);
    if (typeInfo?.isBitmap && typeInfo.bitmapTypeName) {
      const bitmapType = typeInfo.bitmapTypeName;
      const fields = input.symbols!.bitmapFields.get(bitmapType);
      if (fields?.has(memberName)) {
        const fieldInfo = fields.get(memberName)!;
        const bitmapResult = accessGenerators.generateBitmapFieldAccess(
          result,
          fieldInfo,
        );
        applyAccessEffects(bitmapResult.effects, effects);
        output.result = bitmapResult.code;
        return output;
      } else {
        throw new Error(
          `Error: Unknown bitmap field '${memberName}' on type '${bitmapType}'`,
        );
      }
    }
  }

  // Check for scope member access
  if (result === "__THIS_SCOPE__") {
    if (!state.currentScope) {
      throw new Error("Error: 'this' can only be used inside a scope");
    }
    const fullName = `${state.currentScope}_${memberName}`;
    const constValue = input.symbols!.scopePrivateConstValues.get(fullName);
    if (constValue !== undefined) {
      output.result = constValue;
      output.currentIdentifier = fullName;
    } else {
      output.result = fullName;
      output.currentIdentifier = fullName;
      if (!input.symbols!.knownEnums.has(fullName)) {
        const resolvedTypeInfo = input.typeRegistry.get(fullName);
        if (
          resolvedTypeInfo &&
          orchestrator.isKnownStruct(resolvedTypeInfo.baseType)
        ) {
          output.currentStructType = resolvedTypeInfo.baseType;
        }
      }
    }
    return output;
  }

  // Check for known scope access
  if (orchestrator.isKnownScope(result)) {
    if (!isGlobalAccess && result === state.currentScope) {
      throw new Error(
        `Error: Cannot reference own scope '${result}' by name. Use 'this.${memberName}' instead of '${result}.${memberName}'`,
      );
    }
    orchestrator.validateCrossScopeVisibility(result, memberName);
    output.result = `${result}${orchestrator.getScopeSeparator(isCppAccessChain)}${memberName}`;
    output.currentIdentifier = output.result;
    const resolvedTypeInfo = input.typeRegistry.get(output.result);
    if (
      resolvedTypeInfo &&
      orchestrator.isKnownStruct(resolvedTypeInfo.baseType)
    ) {
      output.currentStructType = resolvedTypeInfo.baseType;
    }
    return output;
  }

  // Check for enum member access
  if (input.symbols!.knownEnums.has(result)) {
    if (!isGlobalAccess) {
      const belongsToCurrentScope =
        state.currentScope && result.startsWith(state.currentScope + "_");
      if (state.currentScope && !belongsToCurrentScope) {
        throw new Error(
          `Error: Use 'global.${result}.${memberName}' to access enum '${result}' from inside scope '${state.currentScope}'`,
        );
      }
    }
    output.result = `${result}${orchestrator.getScopeSeparator(isCppAccessChain)}${memberName}`;
    return output;
  }

  // Check for register member access
  if (input.symbols!.knownRegisters.has(result)) {
    if (!isGlobalAccess) {
      const registerBelongsToCurrentScope =
        state.currentScope && result.startsWith(state.currentScope + "_");
      if (state.currentScope && !registerBelongsToCurrentScope) {
        throw new Error(
          `Error: Use 'global.${result}.${memberName}' to access register '${result}' from inside scope '${state.currentScope}'`,
        );
      }
    }
    const accessMod = input.symbols!.registerMemberAccess.get(
      `${result}_${memberName}`,
    );
    if (accessMod === "wo") {
      throw new Error(
        `cannot read from write-only register member '${memberName}' ` +
          `(${result}.${memberName} has 'wo' access modifier)`,
      );
    }
    output.result = `${result}_${memberName}`;
    output.isRegisterChain = true;
    return output;
  }

  // Struct parameter access
  if (isStructParam && result === primaryId) {
    const structParamSep = memberAccessChain.getStructParamSeparator({
      cppMode: orchestrator.isCppMode(),
    });
    output.result = `${result}${structParamSep}${memberName}`;
    output.previousStructType = currentStructType;
    output.previousMemberName = memberName;
    if (currentStructType) {
      const memberTypeInfo = orchestrator.getMemberTypeInfo(
        currentStructType,
        memberName,
      );
      if (memberTypeInfo) {
        output.currentMemberIsArray = memberTypeInfo.isArray;
        output.currentStructType = memberTypeInfo.baseType;
      }
    }
    return output;
  }

  // Check for register member with bitmap type (e.g., MOTOR_CTRL.Running)
  if (input.symbols!.registerMemberTypes.has(result)) {
    const bitmapType = input.symbols!.registerMemberTypes.get(result)!;
    const fields = input.symbols!.bitmapFields.get(bitmapType);
    if (fields?.has(memberName)) {
      const fieldInfo = fields.get(memberName)!;
      const bitmapResult = accessGenerators.generateBitmapFieldAccess(
        result,
        fieldInfo,
      );
      applyAccessEffects(bitmapResult.effects, effects);
      output.result = bitmapResult.code;
      return output;
    } else {
      throw new Error(
        `Error: Unknown bitmap field '${memberName}' on register member '${result}' (bitmap type '${bitmapType}')`,
      );
    }
  }

  // Check for struct member with bitmap type (e.g., device.flags.Active)
  if (currentStructType && input.symbols!.bitmapFields.has(currentStructType)) {
    const fields = input.symbols!.bitmapFields.get(currentStructType)!;
    if (fields.has(memberName)) {
      const fieldInfo = fields.get(memberName)!;
      const bitmapResult = accessGenerators.generateBitmapFieldAccess(
        result,
        fieldInfo,
      );
      applyAccessEffects(bitmapResult.effects, effects);
      output.result = bitmapResult.code;
      return output;
    } else {
      throw new Error(
        `Error: Unknown bitmap field '${memberName}' on struct member '${result}' (bitmap type '${currentStructType}')`,
      );
    }
  }

  // Default member access
  const separator = isCppAccessChain ? "::" : ".";
  output.result = `${result}${separator}${memberName}`;
  output.previousStructType = currentStructType;
  output.previousMemberName = memberName;
  if (currentStructType) {
    const memberTypeInfo = orchestrator.getMemberTypeInfo(
      currentStructType,
      memberName,
    );
    if (memberTypeInfo) {
      output.currentMemberIsArray = memberTypeInfo.isArray;
      output.currentStructType = memberTypeInfo.baseType;
      output.currentIdentifier = undefined;
    }
  }
  return output;
};

/**
 * Subscript access result.
 */
interface SubscriptAccessResult {
  result: string;
  currentStructType?: string;
  currentMemberIsArray?: boolean;
  remainingArrayDims?: number;
  subscriptDepth?: number;
}

/**
 * Generate subscript access (arr[i] or value[bit]).
 */
const generateSubscriptAccess = (
  result: string,
  op: Parser.PostfixOpContext,
  primaryId: string | undefined,
  primaryTypeInfo:
    | { baseType: string; arrayDimensions?: (number | string)[] }
    | undefined,
  currentIdentifier: string | undefined,
  currentStructType: string | undefined,
  currentMemberIsArray: boolean,
  remainingArrayDims: number,
  subscriptDepth: number,
  isRegisterChain: boolean,
  input: IGeneratorInput,
  state: IGeneratorState,
  orchestrator: IOrchestrator,
  effects: TGeneratorEffect[],
): SubscriptAccessResult => {
  const exprs = op.expression();
  const output: SubscriptAccessResult = {
    result,
    currentStructType,
    currentMemberIsArray: false,
    remainingArrayDims,
    subscriptDepth,
  };

  if (exprs.length === 1) {
    const index = orchestrator.generateExpression(exprs[0]);

    // Check if result is a register member with bitmap type
    if (input.symbols!.registerMemberTypes.has(result)) {
      const bitmapType = input.symbols!.registerMemberTypes.get(result)!;
      const line = op.start?.line ?? 0;
      throw new Error(
        `Error at line ${line}: Cannot use bracket indexing on bitmap type '${bitmapType}'. ` +
          `Use named field access instead (e.g., ${result.split("_").at(-1)}.FIELD_NAME).`,
      );
    }

    const isRegisterAccess =
      isRegisterChain ||
      (primaryId ? input.symbols!.knownRegisters.has(primaryId) : false);

    const identifierToCheck = currentIdentifier || primaryId;
    const identifierTypeInfo = identifierToCheck
      ? input.typeRegistry.get(identifierToCheck)
      : undefined;
    const isPrimaryArray = identifierTypeInfo?.isArray ?? false;
    const isPrimitiveIntMember =
      currentStructType && TypeCheckUtils.isInteger(currentStructType);

    if (isRegisterAccess) {
      output.result = `((${result} >> ${index}) & 1)`;
    } else if (currentMemberIsArray) {
      output.result = `${result}[${index}]`;
      output.currentMemberIsArray = false;
      output.subscriptDepth = subscriptDepth + 1;
    } else if (remainingArrayDims > 0) {
      output.result = `${result}[${index}]`;
      output.remainingArrayDims = remainingArrayDims - 1;
      output.subscriptDepth = subscriptDepth + 1;
      if (output.remainingArrayDims === 0 && primaryTypeInfo) {
        output.currentStructType = primaryTypeInfo.baseType;
      }
    } else if (isPrimitiveIntMember) {
      output.result = `((${result} >> ${index}) & 1)`;
      output.currentStructType = undefined;
    } else if (isPrimaryArray) {
      output.result = `${result}[${index}]`;
      output.subscriptDepth = subscriptDepth + 1;
      if (identifierTypeInfo && !currentStructType) {
        const elementType = identifierTypeInfo.baseType;
        if (orchestrator.isKnownStruct(elementType)) {
          output.currentStructType = elementType;
        }
      }
    } else {
      const subscriptKind = SubscriptClassifier.classify({
        typeInfo: identifierTypeInfo ?? null,
        subscriptCount: 1,
        isRegisterAccess: false,
      });

      if (subscriptKind === "bit_single") {
        output.result = `((${result} >> ${index}) & 1)`;
      } else {
        output.result = `${result}[${index}]`;
      }
    }
  } else if (exprs.length === 2) {
    // Bit range: value[start, width]
    const start = orchestrator.generateExpression(exprs[0]);
    const width = orchestrator.generateExpression(exprs[1]);

    const isFloatType =
      primaryTypeInfo?.baseType === "f32" ||
      primaryTypeInfo?.baseType === "f64";

    if (isFloatType && primaryId) {
      if (!state.inFunctionBody) {
        throw new Error(
          `Float bit indexing reads (${primaryId}[${start}, ${width}]) cannot be used at global scope.`,
        );
      }

      effects.push(
        { type: "include", header: "string" },
        { type: "include", header: "float_static_assert" },
      );

      const isF64 = primaryTypeInfo?.baseType === "f64";
      const shadowType = isF64 ? "uint64_t" : "uint32_t";
      const shadowName = `__bits_${primaryId}`;
      const mask = orchestrator.generateBitMask(width, isF64);

      const needsDeclaration = !orchestrator.hasFloatBitShadow(shadowName);
      if (needsDeclaration) {
        orchestrator.registerFloatBitShadow(shadowName);
        orchestrator.addPendingTempDeclaration(`${shadowType} ${shadowName};`);
      }

      const shadowIsCurrent = orchestrator.isFloatShadowCurrent(shadowName);
      orchestrator.markFloatShadowCurrent(shadowName);

      if (shadowIsCurrent) {
        if (start === "0") {
          output.result = `(${shadowName} & ${mask})`;
        } else {
          output.result = `((${shadowName} >> ${start}) & ${mask})`;
        }
      } else if (start === "0") {
        output.result = `(memcpy(&${shadowName}, &${result}, sizeof(${result})), (${shadowName} & ${mask}))`;
      } else {
        output.result = `(memcpy(&${shadowName}, &${result}, sizeof(${result})), ((${shadowName} >> ${start}) & ${mask}))`;
      }
    } else {
      const mask = orchestrator.generateBitMask(width);
      if (start === "0") {
        output.result = `((${result}) & ${mask})`;
      } else {
        output.result = `((${result} >> ${start}) & ${mask})`;
      }
    }
  }

  return output;
};

/**
 * Apply effects from access generators.
 */
const applyAccessEffects = (
  sourceEffects: readonly TGeneratorEffect[],
  targetEffects: TGeneratorEffect[],
): void => {
  for (const effect of sourceEffects) {
    targetEffects.push(effect);
  }
};

export default generatePostfixExpression;
