/**
 * HeaderSymbolAdapter - Converts TSymbol to IHeaderSymbol.
 *
 * ADR-055 Phase 7: This adapter converts the TSymbol discriminated union
 * to IHeaderSymbol for header generation.
 */

import TSymbol from "../../../types/symbols/TSymbol";
import IHeaderSymbol from "../types/IHeaderSymbol";
import IParameterSymbol from "../../../../utils/types/IParameterSymbol";
import TypeResolver from "../../../../utils/TypeResolver";
import ScopeUtils from "../../../../utils/ScopeUtils";
import QualifiedCName from "../../../../utils/QualifiedCName";
import CodeGenState from "../../../state/CodeGenState";

/**
 * Adapter to convert TSymbol to IHeaderSymbol
 */
class HeaderSymbolAdapter {
  /**
   * Convert a TSymbol to IHeaderSymbol
   */
  static fromTSymbol(symbol: TSymbol): IHeaderSymbol {
    switch (symbol.kind) {
      case "function":
        return HeaderSymbolAdapter.convertFunction(symbol);
      case "variable":
        return HeaderSymbolAdapter.convertVariable(symbol);
      case "struct":
        return HeaderSymbolAdapter.convertStruct(symbol);
      case "enum":
        return HeaderSymbolAdapter.convertEnum(symbol);
      case "bitmap":
        return HeaderSymbolAdapter.convertBitmap(symbol);
      case "register":
        return HeaderSymbolAdapter.convertRegister(symbol);
      case "scope":
        return HeaderSymbolAdapter.convertScope(symbol);
    }
  }

  /**
   * Convert an array of TSymbols to IHeaderSymbols
   */
  static fromTSymbols(symbols: TSymbol[]): IHeaderSymbol[] {
    return symbols.map((s) => HeaderSymbolAdapter.fromTSymbol(s));
  }

  // ========================================================================
  // Private conversion methods for each TSymbol kind
  // ========================================================================

  private static convertFunction(
    func: import("../../../types/symbols/IFunctionSymbol").default,
  ): IHeaderSymbol {
    // Convert TType return type to string
    const returnTypeStr = TypeResolver.getTypeName(func.returnType);

    // Get transpiled C name (scope-prefixed)
    const cName = ScopeUtils.getTranspiledCName(func);
    const isGlobal = func.scope.name === "";

    // ADR-057: type names arrive already scope-qualified from the symbol
    // layer (CNextResolver pre-pass), so no qualification is needed here.
    const parameters: IParameterSymbol[] = func.parameters.map((p) => {
      return {
        name: p.name,
        type: TypeResolver.getTypeName(p.type),
        isConst: p.isConst,
        isArray: p.isArray,
        arrayDimensions: p.arrayDimensions?.map((d) =>
          typeof d === "number" ? String(d) : d,
        ),
        isAutoConst: p.isAutoConst,
      };
    });

    // Build signature with return type and param types
    const qualifiedReturn = returnTypeStr;
    const paramTypes = parameters.map((p) => p.type);
    const signature = `${qualifiedReturn} ${cName}(${paramTypes.join(", ")})`;

    return {
      name: cName,
      kind: "function",
      type: qualifiedReturn,
      isExported: func.isExported,
      parameters,
      signature,
      parent: isGlobal ? undefined : func.scope.name,
      sourceFile: func.sourceFile,
      sourceLine: func.sourceLine,
    };
  }

  private static convertVariable(
    variable: import("../../../types/symbols/IVariableSymbol").default,
  ): IHeaderSymbol {
    // Get transpiled C name (scope-prefixed)
    const cName = ScopeUtils.getTranspiledCName(variable);
    const isGlobal = variable.scope.name === "";

    // ADR-057: the symbol layer already qualified scope-local type names.
    const typeStr = TypeResolver.getTypeName(variable.type);

    // Convert dimensions to strings and resolve qualified enum access
    const arrayDimensions = variable.arrayDimensions?.map((d) =>
      typeof d === "number"
        ? String(d)
        : HeaderSymbolAdapter.resolveArrayDimension(d, variable.scope.name),
    );

    return {
      name: cName,
      kind: "variable",
      type: typeStr,
      isExported: variable.isExported,
      isConst: variable.isConst,
      isAtomic: variable.isAtomic,
      isArray: variable.isArray,
      arrayDimensions,
      parent: isGlobal ? undefined : variable.scope.name,
      sourceFile: variable.sourceFile,
      sourceLine: variable.sourceLine,
    };
  }

  private static convertStruct(
    struct: import("../../../types/symbols/IStructSymbol").default,
  ): IHeaderSymbol {
    // Get transpiled C name (scope-prefixed)
    const cName = ScopeUtils.getTranspiledCName(struct);
    const isGlobal = struct.scope.name === "";

    return {
      name: cName,
      kind: "struct",
      isExported: struct.isExported,
      parent: isGlobal ? undefined : struct.scope.name,
      sourceFile: struct.sourceFile,
      sourceLine: struct.sourceLine,
    };
  }

  private static convertEnum(
    enumSym: import("../../../types/symbols/IEnumSymbol").default,
  ): IHeaderSymbol {
    // Get transpiled C name (scope-prefixed)
    const cName = ScopeUtils.getTranspiledCName(enumSym);
    const isGlobal = enumSym.scope.name === "";

    return {
      name: cName,
      kind: "enum",
      isExported: enumSym.isExported,
      parent: isGlobal ? undefined : enumSym.scope.name,
      sourceFile: enumSym.sourceFile,
      sourceLine: enumSym.sourceLine,
    };
  }

  private static convertBitmap(
    bitmap: import("../../../types/symbols/IBitmapSymbol").default,
  ): IHeaderSymbol {
    // Get transpiled C name (scope-prefixed)
    const cName = ScopeUtils.getTranspiledCName(bitmap);
    const isGlobal = bitmap.scope.name === "";

    return {
      name: cName,
      kind: "bitmap",
      type: bitmap.backingType,
      isExported: bitmap.isExported,
      parent: isGlobal ? undefined : bitmap.scope.name,
      sourceFile: bitmap.sourceFile,
      sourceLine: bitmap.sourceLine,
    };
  }

  private static convertRegister(
    register: import("../../../types/symbols/IRegisterSymbol").default,
  ): IHeaderSymbol {
    // Get transpiled C name (scope-prefixed)
    const cName = ScopeUtils.getTranspiledCName(register);
    const isGlobal = register.scope.name === "";

    return {
      name: cName,
      kind: "register",
      isExported: register.isExported,
      parent: isGlobal ? undefined : register.scope.name,
      sourceFile: register.sourceFile,
      sourceLine: register.sourceLine,
    };
  }

  private static convertScope(
    scope: import("../../../types/symbols/IScopeSymbol").default,
  ): IHeaderSymbol {
    return {
      name: scope.name,
      kind: "scope",
      isExported: scope.isExported,
      sourceFile: scope.sourceFile,
      sourceLine: scope.sourceLine,
    };
  }

  /**
   * Convert an array dimension string to C-compatible format.
   *
   * The dimension arrives as written in C-Next SOURCE (`State.COUNT`,
   * `this.State.COUNT`, `global.EColor.COUNT`), not as a generated C name, so it
   * has to be resolved the same way the `.c` path resolves it — otherwise the
   * header and the implementation derive different names for the same array and
   * the header does not compile (#1117 review).
   *
   * Sharing `QualifiedCName.join()` is not sufficient on its own: both sides must
   * also agree on *what to join*. A bare `State.COUNT` written inside `scope Motor`
   * refers to `Motor.State.COUNT` and must become `Motor__State__COUNT`, while a
   * top-level `EColor.COUNT` must stay `EColor__COUNT`.
   *
   * @param dim - Dimension as written in source; may be a qualified enum access
   * @param scopeName - Name of the scope declaring the variable ("" for global)
   * @returns C-compatible dimension string
   * @example resolveArrayDimension("EColor.COUNT", "") => "EColor__COUNT"
   * @example resolveArrayDimension("State.COUNT", "Motor") => "Motor__State__COUNT"
   * @example resolveArrayDimension("this.State.COUNT", "Motor") => "Motor__State__COUNT"
   * @example resolveArrayDimension("global.EColor.COUNT", "Motor") => "EColor__COUNT"
   * @example resolveArrayDimension("10", "Motor") => "10"
   */
  private static resolveArrayDimension(dim: string, scopeName: string): string {
    if (!dim.includes(QualifiedCName.SOURCE_SEPARATOR)) {
      return dim;
    }

    const parts = dim.split(QualifiedCName.SOURCE_SEPARATOR);

    // `global.X.Y` is explicitly global — drop the marker, add no scope prefix
    if (parts[0] === "global") {
      return QualifiedCName.join(...parts.slice(1));
    }

    // `this.X.Y` is explicitly scope-local — drop the marker, prefix the scope
    if (parts[0] === "this") {
      return QualifiedCName.join(scopeName, ...parts.slice(1));
    }

    // Bare `X.Y` inside a scope resolves scope-first, then global (ADR-057).
    // Prefix only when the scope really declares that enum, matching the `.c` path.
    if (
      scopeName &&
      CodeGenState.isKnownEnum(QualifiedCName.join(scopeName, parts[0]))
    ) {
      return QualifiedCName.join(scopeName, ...parts);
    }

    return QualifiedCName.join(...parts);
  }
}

export default HeaderSymbolAdapter;
