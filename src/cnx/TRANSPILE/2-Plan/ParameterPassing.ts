import SymbolTypeResolver from "../../utils/TypeResolver";
import SymbolGuards from "../../types/symbols/SymbolGuards";
import ParameterInfoPlanner from "./ParameterInfoPlanner";
import CallExprUtils from "./CallExprUtils";
import CppNamespaceUtils from "../../utils/CppNamespaceUtils";
import type ICallbackTypeInfo from "../../types/ICallbackTypeInfo";
import type TranspileState from "../TranspileState";
import type IParameterPassing from "../../types/IParameterPassing";

type TParameterPassingFacts = Pick<
  TranspileState,
  "callbackTypedefTypeFor" | "program" | "isKnownStruct"
> & { readonly callbackTypes: ReadonlyMap<string, ICallbackTypeInfo> };

/**
 * #1639: whether each parameter of a C-Next function is passed by value or
 * through a pointer, decided once. The `.c` signature, the `.h` prototype, the
 * `_fp` typedef, the body's uses of the parameter and every call to the
 * function read this answer; none of them works it out again.
 */
class ParameterPassing {
  /**
   * Parameter `paramIndex` of the function emitted as `functionName`.
   * `isDirectCall` is false for a call through an ADR-029 callback value, and
   * for the `_fp` typedef that call is checked against: both are built from
   * the declaration, never from a C typedef the function is also wired to.
   */
  static of(
    functionName: string,
    paramIndex: number,
    facts: TParameterPassingFacts,
    isDirectCall = true,
  ): IParameterPassing {
    const param = ParameterInfoPlanner.settledParameters(functionName, facts)[
      paramIndex
    ];
    const typeName = SymbolTypeResolver.getTypeName(param.type);
    const isOpaqueHandle = param.isOpaqueHandle === true;

    // Issue #895: a C callback typedef the function is wired to decides
    // pointer or value. A `mut` parameter keeps its pointer even where the
    // typedef takes a copy: the copy would lose the write (#2146).
    const typedef = isDirectCall
      ? ParameterInfoPlanner.callbackTypedefParamInfo(
          functionName,
          paramIndex,
          facts,
        )
      : null;
    if (typedef && (typedef.isParamPointer || param.isConst)) {
      return ParameterPassing.passing(
        !typedef.isParamPointer,
        typedef.isParamPointer,
        typedef.isParamConst,
        isOpaqueHandle,
      );
    }
    if (typedef) {
      return ParameterPassing.passing(false, false, false, isOpaqueHandle);
    }

    return ParameterPassing.passing(
      ParameterPassing.isByValue(
        functionName,
        param.name,
        typeName,
        param.isArray,
        isOpaqueHandle,
        facts,
        isDirectCall,
      ),
      false,
      false,
      isOpaqueHandle,
    );
  }

  private static isByValue(
    functionName: string,
    paramName: string,
    typeName: string,
    isArray: boolean,
    isOpaqueHandle: boolean,
    facts: TParameterPassingFacts,
    isDirectCall: boolean,
  ): boolean {
    if (isArray || isOpaqueHandle) return false;
    const program = facts.program;

    // ADR-071 Q6: a read-only scalar, by its declaration (1.4)
    if (program?.passByValueParams().get(functionName)?.has(paramName)) {
      return true;
    }

    // ADR-029: a function pointer is a value. The settled program names the
    // function even before this file registers its callback type, as for the
    // `_fp` typedef of a function declared ahead of the one it takes (#1929).
    const typeSymbol = program?.symbolByCName(typeName);
    if (
      facts.callbackTypes.has(typeName) ||
      (typeSymbol !== undefined && SymbolGuards.isFunction(typeSymbol))
    ) {
      return true;
    }

    // 1.4 settles a C++ namespaced struct as `hw__Dev`, which the struct
    // registry knows as `hw::Dev` (#1520)
    const isKnownStruct =
      facts.isKnownStruct(typeName) ||
      facts.isKnownStruct(
        CppNamespaceUtils.convertToCppNamespace(
          typeName,
          program?.symbolTable(),
        ),
      );

    // #1603: a callback-compatible function whose typedef does not resolve
    // takes a struct by value, as such typedefs usually do
    if (
      isDirectCall &&
      isKnownStruct &&
      program?.callbackCompatibleFunctions().has(functionName)
    ) {
      return true;
    }

    // ADR-006: a struct, primitive, enum or string goes through a pointer.
    // Issue #551: anything else -- an external typedef or enum -- is a value.
    return !(
      isKnownStruct ||
      CallExprUtils.isStringType(typeName) ||
      CallExprUtils.isKnownPrimitiveType(typeName) ||
      (program?.knownEnums().has(typeName) ?? false)
    );
  }

  private static passing(
    byValue: boolean,
    typedefPointer: boolean,
    typedefConst: boolean,
    isOpaqueHandle: boolean,
  ): IParameterPassing {
    return {
      byValue,
      typedefPointer,
      typedefConst,
      argument: byValue || isOpaqueHandle ? "value" : "reference",
    };
  }
}

export default ParameterPassing;
