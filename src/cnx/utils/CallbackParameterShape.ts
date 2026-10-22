import type ICallbackTypedefParameter from "../types/ICallbackTypedefParameter";
import type IFunctionSymbol from "../types/symbols/IFunctionSymbol";
import CppNamespaceUtils from "./CppNamespaceUtils";
import DeclaredPointer from "./DeclaredPointer";
import invariant from "./invariant";
import ParameterByValue from "./ParameterByValue";
import type ICallbackShapeFacts from "./types/ICallbackShapeFacts";
import ParameterConst from "./ParameterConst";
import TypeCheckUtils from "./TypeCheckUtils";
import SymbolTypeResolver from "./TypeResolver";

/**
 * ADR-029 + ADR-006: what a cnx function's `_fp` typedef says -- its return
 * type and what each parameter MEANS, its rendered type and its pointer
 * semantics. 2.2 builds the typedef from this, and 2.1 holds a C header's
 * function to the same answer (#1619), so the two cannot describe the
 * typedef differently.
 *
 * Kept as one decision since two builders shared it (#1491, #1552); one
 * builder is left (#1929).
 */
class CallbackParameterShape {
  /**
   * ADR-029: the typedef name for a function-as-type. One encoder, so the
   * declaration site and every reference cannot spell it differently.
   */
  static typedefName(functionName: string): string {
    return `${functionName}_fp`;
  }

  static returnType(
    symbol: IFunctionSymbol,
    facts: ICallbackShapeFacts,
  ): string {
    return facts.cType(SymbolTypeResolver.getTypeName(symbol.returnType));
  }

  static parameters(
    cName: string,
    symbol: IFunctionSymbol,
    facts: ICallbackShapeFacts,
  ): Array<Required<ICallbackTypedefParameter>> {
    const settled = ParameterByValue.settledParameters(cName, facts);
    return symbol.parameters.map((param, index) => {
      const typeName = SymbolTypeResolver.getTypeName(param.type);
      // Spread, not re-listed: a field the shape gains reaches the typedef
      // (#1552 was a builder dropping one).
      const shape = CallbackParameterShape.shape(
        typeName,
        param.isArray,
        facts,
      );
      // #1290 review: the typedef names a parameter as its prototype does
      invariant(
        param.emittedName !== null,
        `1.4 settled the C name of ${cName}'s parameter ${param.name}`,
      );
      // #1639: from the declaration, as a call through the type passes it
      const declared = settled[index];
      return {
        name: param.emittedName,
        ...shape,
        isConst: ParameterConst.isWritten(
          param.isConst,
          typeName,
          facts.isFunctionType(typeName),
        ),
        isArray: param.isArray,
        // ADR-071 Q6: a `mut` scalar is a pointer, as in its prototype
        isPointer: !ParameterByValue.of(
          cName,
          declared.name,
          SymbolTypeResolver.getTypeName(declared.type),
          declared.isArray,
          declared.isOpaqueHandle === true,
          facts,
          false,
        ),
        // Already folded to literals by the symbols layer, which is exactly
        // what MISRA Rule 18.8 needs -- a dimension that is still an
        // identifier makes the typedef a variably-modified type.
        arrayDims: (param.arrayDimensions ?? [])
          .map((dimension) => `[${dimension}]`)
          .join(""),
      };
    });
  }

  private static shape(
    typeName: string,
    isArray: boolean,
    facts: ICallbackShapeFacts,
  ): {
    type: string;
    isStruct: boolean;
    isString: boolean;
    isOpaqueHandle: boolean;
  } {
    // ADR-006: struct-ness drives reference semantics. A C++ namespaced
    // struct is known by its `::` spelling, which is how the prototype that
    // takes it by reference names it; the C join (`hw__Dev`) is not.
    const isStruct = facts.isKnownStruct(
      CppNamespaceUtils.convertToCppNamespace(typeName, facts.symbolTable),
    );

    // ADR-029: a parameter whose type is itself a function-as-type.
    if (facts.isFunctionType(typeName)) {
      // Function pointers are already pointers.
      return {
        type: CallbackParameterShape.typedefName(typeName),
        isStruct,
        isString: false,
        isOpaqueHandle: false,
      };
    }
    // ADR-045: a `string<N>` parameter is `char*` in C. Decided HERE, not in
    // either caller's renderer, because that is where the two disagreed: the
    // parse-tree renderer answered `char` (the ELEMENT type) and the symbol
    // renderer answered `string<8>` (cnx surface syntax, not C at all, and
    // rejected by cc while the transpiler exited 0). Both are now wrong in one
    // place instead of differently wrong in two -- which is the property this
    // method exists to hold, and the one its comment already claimed.
    if (!isArray && TypeCheckUtils.isSizedStringName(typeName)) {
      return {
        type: "char*",
        isStruct: false,
        isString: true,
        isOpaqueHandle: false,
      };
    }

    // ADR-030: an opaque handle is a pointer in the typedef exactly as it is in
    // the prototype -- `Dev*` in C and C++ alike, and an array of them an array
    // of pointers (#996). The typedef IS the function's type, so it reads the
    // decision the prototype reads rather than asking struct-ness, which never
    // answered for an incomplete type: `typedef void (*aPoke_fp)(Dev)` stood
    // beside `void aPoke(Dev* d)`. Not ADR-006 reference semantics, so not
    // `isStruct` -- which is also what keeps an unmodified handle free of the
    // auto-const its prototype never takes.
    if (DeclaredPointer.isHandleType(typeName, facts.symbolTable)) {
      return {
        type: facts.cType(typeName),
        isStruct: false,
        isString: false,
        isOpaqueHandle: true,
      };
    }

    // ADR-006: a struct parameter is a pointer in C and a reference in C++,
    // which the formatter spells from `isStruct`.
    return {
      type: facts.cType(typeName),
      isStruct,
      isString: false,
      isOpaqueHandle: false,
    };
  }
}

export default CallbackParameterShape;
