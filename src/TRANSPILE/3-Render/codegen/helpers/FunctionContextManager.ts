/**
 * FunctionContextManager - Manages function context lifecycle and parameter processing
 *
 * Issue #793: Extracted from CodeGenerator to reduce file size.
 *
 * Handles:
 * - Function context setup/cleanup lifecycle
 * - Parameter type resolution and registration
 * - Return type resolution (including main() special case)
 * - Function body enter/exit coordination
 *
 * ## It reads planned parameters, not parse nodes (#1445)
 *
 * It asked a `ParameterContext` three questions -- the name, whether it is an
 * array, what its type is -- and everything after that comes from
 * `CodeGenState` and the callback typedef. Those three answers arrive as
 * `IPlannedFunctionParameter` now, and the type's alternatives come already
 * classified by `TypeBinding`, 1.3 Declare's one ladder, rather than from a
 * fourth walk here.
 */

import IFunctionContextCallbacks from "../types/IFunctionContextCallbacks";
// Issue #895: Parse typedef signatures to determine pointer vs value params
import TypedefParamParser from "./TypedefParamParser";
import SymbolGuards from "../../../../transpiler/types/symbols/SymbolGuards";
import invariant from "../../../../utils/invariant";
import type IPlannedFunctionParameter from "../types/IPlannedFunctionParameter";
import type IPlannedType from "../types/IPlannedType";
import type TranspileState from "../../../TranspileState";

/**
 * Result from resolving parameter type information.
 */
interface IParameterTypeInfo {
  typeName: string;
  isStruct: boolean;
  isCallback: boolean;
  isString: boolean;
}

/**
 * Result from resolving return type and params for a function.
 */
interface IReturnTypeAndParams {
  actualReturnType: string;
  initialParams: string;
}

/**
 * Manages function context lifecycle and parameter processing.
 */
class FunctionContextManager {
  /**
   * Resolve return type and initial params for function.
   * Handles main() special cases:
   * - main(u8 args[][]) -> int main(int argc, char *argv[])
   * - main() -> int main() (for C++ compatibility)
   */
  static resolveReturnTypeAndParams(
    name: string,
    returnType: string,
    isMainWithArgs: boolean,
    firstParameterName: string | undefined,
    state: TranspileState,
  ): IReturnTypeAndParams {
    if (isMainWithArgs) {
      // Special case: main(u8 args[][]) -> int main(int argc, char *argv[])
      state.mainArgsName = firstParameterName ?? null;
      return {
        actualReturnType: "int",
        initialParams: "int argc, char *argv[]",
      };
    }

    // For main() without args, always use int return type for C++ compatibility
    const actualReturnType = name === "main" ? "int" : returnType;
    return { actualReturnType, initialParams: "" };
  }

  /**
   * Process parameter list and register parameters in state.
   */
  static processParameterList(
    params: readonly IPlannedFunctionParameter[] | null,
    callbacks: IFunctionContextCallbacks,
    state: TranspileState,
  ): void {
    state.currentParameters.clear();
    if (!params) return;

    for (let i = 0; i < params.length; i++) {
      FunctionContextManager.processParameter(params[i], callbacks, i, state);
    }
  }

  /**
   * Process a single parameter declaration.
   */
  static processParameter(
    param: IPlannedFunctionParameter,
    callbacks: IFunctionContextCallbacks,
    paramIndex: number,
    state: TranspileState,
  ): void {
    const { name, isArray, isConst } = param;

    // Resolve type information
    const typeInfo = FunctionContextManager.resolveParameterTypeInfo(
      param.type,
      callbacks,
      state,
    );

    // Issue #895: For callback-compatible functions, check the typedef signature
    // to determine if the param should be a pointer or value
    const callbackTypedefInfo =
      FunctionContextManager.getCallbackTypedefParamInfo(paramIndex, state);
    const isCallbackPointerParam = callbackTypedefInfo?.isParamPointer ?? false;

    // ADR-030 / #1722: whether this parameter holds opaque handles -- read from
    // the stamp 1.4 set on the function's settled parameter, the one decision
    // the `.h` prototype reads too. An opaque type reaches `isStruct` through
    // it (#958's "C-header typedef struct needs pointer semantics" is the same
    // fact: StructCollector marks both under one condition), and a complete
    // one through its known fields, so `isStruct` alone cannot tell the two
    // apart -- and they differ in exactly the fact that matters: a complete
    // struct's value is `(*p)`, while an opaque handle's value is `p`, because
    // the pointer IS the handle. The signature (`ParameterInputAdapter.fromAST`)
    // and every whole-value use of the parameter read this answer rather than
    // asking again. No shape of the parameter is excepted: an array of handles
    // is an array of pointers (#996), and the `!isArray` this once carried is
    // what left `Dev[2] arr` as `Dev arr[2]`.
    const isOpaqueHandle = FunctionContextManager.parameterHoldsHandle(
      paramIndex,
      state,
    );

    // Determine isStruct: for callback-compatible params, both typedef AND type info matter
    // - If typedef says pointer AND it's actually a struct, use -> access (isStruct=true)
    // - If typedef says pointer BUT it's a primitive (like u8), don't treat as struct
    //   (primitives use forcePointerSemantics for dereference instead)
    // Issue #958: C-header typedef struct types are always treated as struct (pointer semantics)
    const isStruct = callbackTypedefInfo
      ? isCallbackPointerParam && typeInfo.isStruct
      : typeInfo.isStruct || isOpaqueHandle;

    // Issue #895: Primitive types that become pointers need dereferencing when used as values
    // e.g., "u8 buf" becoming "uint8_t* buf" requires "*buf" when accessing the value
    // #1600: a string<N> is ALREADY a char* -- it is not a primitive that
    // became a pointer to match the typedef, so it needs no dereference when
    // used as a value. Without this term ParameterDereferenceResolver returns
    // `(*msg)` for every whole-value use, and the ADR-045 string rule fifteen
    // lines into isPassByValue is unreachable because this flag returns first.
    //
    // An OPAQUE handle is the same case one type over: `widget_t` is an
    // incomplete typedef, so it is only ever a pointer and `(*w)` is
    // `error: invalid use of incomplete typedef`. It is not caught by
    // `typeInfo.isStruct`, which needs fields the forward declaration does not
    // have -- so it is named here beside the other already-a-pointer shapes.
    const isCallbackPointerPrimitive =
      isCallbackPointerParam &&
      !typeInfo.isStruct &&
      !isArray &&
      !typeInfo.isString &&
      !isOpaqueHandle;

    // Issue #958: a C-header typedef struct -- an opaque handle, the same fact --
    // needs pointer semantics, like a callback pointer param
    const forcePointerSemantics = isCallbackPointerParam || isOpaqueHandle;

    // Register in currentParameters
    const paramInfo = {
      name,
      baseType: typeInfo.typeName,
      isArray,
      isStruct,
      isConst,
      isCallback: typeInfo.isCallback,
      isString: typeInfo.isString,
      isCallbackPointerPrimitive,
      // Issue #895/#958: Force pointer semantics for callback-compatible and typedef struct params
      forcePointerSemantics,
      isOpaqueHandle,
    };
    state.currentParameters.set(name, paramInfo);
  }

  /**
   * Resolve type name and flags from a planned type.
   *
   * Strings are special and stay explicit: a top-level `string<32>` parameter
   * reports the bare "string" (its capacity travels separately through
   * stringCapacities), while a string ARRAY element keeps "string<32>". That
   * asymmetry is load-bearing, so it is preserved rather than folded in.
   *
   * #1285: one ladder for the NAME, then ONE derivation of its consequences.
   * Previously each of the six branches decided isStruct/isCallback for
   * itself, so `isCallback` was hardcoded false in the scoped, qualified and
   * global branches, and `arrayType().userType()` skipped the ADR-057
   * qualification that the bare `userType()` branch applied -- `Mode[4] p`
   * and `Mode p` in the same scope resolved to different names.
   *
   * #1445: that ladder is `TypeBinding`'s, asked once by the planner, so this
   * reads its answer rather than being a fourth caller of it. What is left is
   * the string asymmetry above, the primitive, and the consequences.
   */
  static resolveParameterTypeInfo(
    type: IPlannedType,
    callbacks: IFunctionContextCallbacks,
    state: TranspileState,
  ): IParameterTypeInfo {
    if (type.isString) {
      return {
        typeName: type.isArray ? (type.stringTypeText ?? "string") : "string",
        isStruct: false,
        isCallback: false,
        isString: true,
      };
    }

    if (type.primitiveName !== null) {
      return {
        typeName: type.primitiveName,
        isStruct: false,
        isCallback: false,
        isString: false,
      };
    }

    // What is left when no branch named the type is `templateType` and `void`.
    // Neither is a symbol name, and querying knownStructs/callbackTypes with
    // mangled template text (`FlexCAN_T4<CAN1,RX_SIZE_256,TX_SIZE_16>`) only
    // fails to match by construction of those lookups rather than by intent.
    const typeName = type.named?.name;
    if (typeName === undefined) {
      return {
        typeName: type.text,
        isStruct: false,
        isCallback: false,
        isString: false,
      };
    }

    return {
      typeName,
      isStruct: callbacks.isStructType(typeName),
      isCallback: state.callbackTypes.has(typeName),
      isString: false,
    };
  }
  /**
   * #1545: the C typedef dictating the current function's parameter shape, or
   * undefined when nothing does.
   *
   * This is the FUNCTION-level question, and it is the one ADR-013 auto-const
   * must ask. `getCallbackTypedefParamInfo` below answers a per-PARAMETER
   * question and returns null for a parameter the typedef does not describe --
   * one past its arity, or one whose type `TypedefParamParser` cannot read.
   * Deciding auto-const from that answer made the .c suppress per parameter
   * while the header suppressed per function, so `void (*)(char *)` against
   * `void onTwo(string<32> msg, string<16> tag)` emitted
   * `void onTwo(char* msg, const char* tag)` beside a prototype of
   * `void onTwo(char* msg, char* tag)` -- `error: conflicting types`, which is
   * the defect #1545 exists to remove, one parameter over.
   */
  static callbackTypedefType(state: TranspileState): string | undefined {
    if (state.currentFunctionName === null) return undefined;

    // #1545 review: delegates rather than restating the two steps. This is the
    // current-function convenience over state.callbackTypedefTypeFor,
    // which is the one home for the predicate.
    return state.callbackTypedefTypeFor(state.currentFunctionName);
  }

  /**
   * Issue #895: Get callback typedef parameter info from the C header.
   * Returns null if not callback-compatible or index is invalid.
   */
  static getCallbackTypedefParamInfo(
    paramIndex: number,
    state: TranspileState,
  ): { isParamPointer: boolean; isParamConst: boolean } | null {
    // main's renamed result fields (#1450), with #1545's extracted lookup --
    // the two steps live in state.callbackTypedefTypeFor now, so this
    // site and the header's cannot spell the predicate differently.
    const typedefType = FunctionContextManager.callbackTypedefType(state);
    if (!typedefType) return null;

    const isParamPointer = TypedefParamParser.isParamPointer(
      typedefType,
      paramIndex,
    );
    const isParamConst = TypedefParamParser.isParamConst(
      typedefType,
      paramIndex,
    );

    if (isParamPointer === null) return null;

    return {
      isParamPointer,
      isParamConst: isParamConst ?? false,
    };
  }

  /**
   * ADR-030 / #1722: whether parameter `paramIndex` of the function being
   * generated holds an opaque handle -- the stamp 1.4 Resolve set on its
   * settled symbol (`IParameterInfo.isOpaqueHandle`).
   *
   * Read, never decided here: the `.h` prototype reads the same stamp, so the
   * `.c` signature, its call sites and the header cannot disagree about one
   * parameter. A function being generated always has a settled symbol under
   * its C name, so a missing one is a defect, not a "no".
   */
  private static parameterHoldsHandle(
    paramIndex: number,
    state: TranspileState,
  ): boolean {
    const functionName = state.currentFunctionName;
    const symbol =
      functionName === null
        ? undefined
        : state.program?.symbolByCName(functionName);
    invariant(
      symbol !== undefined && SymbolGuards.isFunction(symbol),
      `a function being generated has a settled symbol (missing ${functionName})`,
    );
    return symbol.parameters[paramIndex]?.isOpaqueHandle === true;
  }

  /**
   * Clear parameter tracking when leaving a function.
   */
  static clearParameters(state: TranspileState): void {
    state.currentParameters.clear();
  }

  /**
   * Enter function body - clears local variables and sets inFunctionBody flag.
   * This is a simpler version used when only body lifecycle is needed.
   */
  static enterFunctionBody(state: TranspileState): void {
    state.enterFunctionBody();
  }

  /**
   * Exit function body - clears local variables and inFunctionBody flag.
   * This is a simpler version used when only body lifecycle is needed.
   */
  static exitFunctionBody(state: TranspileState): void {
    state.mainArgsName = null;
    state.exitFunctionBody();
  }
}

export default FunctionContextManager;
