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
import CodeGenState from "../../../state/CodeGenState";
import type TType from "../../../types/TType";

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
    const isGlobal = ScopeUtils.isGlobalScopePath(func.scopePath);

    // ADR-057: type names arrive already scope-qualified from the symbol
    // layer (CNextResolver pre-pass), so no qualification is needed here.
    const parameters: IParameterSymbol[] = func.parameters.map((p) => {
      return {
        name: p.name,
        type: TypeResolver.getTypeName(p.type),
        isConst: p.isConst,
        isArray: p.isArray,
        arrayDimensions: HeaderSymbolAdapter.headerArrayDimensions(p),
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
      parameters,
      signature,
      parent: isGlobal ? undefined : func.scopePath,
      sourceFile: func.sourceFile,
      sourceLine: func.span.line,
    };
  }

  private static convertVariable(
    variable: import("../../../types/symbols/IVariableSymbol").default,
  ): IHeaderSymbol {
    // Get transpiled C name (scope-prefixed)
    const cName = ScopeUtils.getTranspiledCName(variable);
    const isGlobal = ScopeUtils.isGlobalScopePath(variable.scopePath);

    // ADR-057: the symbol layer already qualified scope-local type names.
    const typeStr = TypeResolver.getTypeName(variable.type);

    // Convert dimensions to strings and resolve qualified enum access
    const arrayDimensions = variable.arrayDimensions?.map((d) =>
      typeof d === "number"
        ? String(d)
        : HeaderSymbolAdapter.resolveArrayDimension(d, variable.scopePath),
    );

    return {
      name: cName,
      kind: "variable",
      type: typeStr,
      isConst: variable.isConst,
      isAtomic: variable.isAtomic,
      isVolatile: variable.isVolatile,
      isArray: variable.isArray,
      arrayDimensions,
      parent: isGlobal ? undefined : variable.scopePath,
      sourceFile: variable.sourceFile,
      sourceLine: variable.span.line,
    };
  }

  /**
   * A parameter's array dimensions as the C declaration needs them.
   *
   * A bounded string array carries its capacity as the innermost dimension --
   * `string<32>[5]` is `char[5][33]`. ParameterSignatureBuilder documents that
   * "dimensions include capacity" and the .c path supplies it; the header did
   * not, so it declared `char arr[5]` against a `char arr[5][33]` definition
   * (#1164).
   */
  private static headerArrayDimensions(parameter: {
    readonly type: TType;
    readonly arrayDimensions?: ReadonlyArray<number | string>;
  }): string[] | undefined {
    const dimensions = parameter.arrayDimensions?.map((d) =>
      typeof d === "number"
        ? String(d)
        : HeaderSymbolAdapter.resolveConstDimension(d),
    );
    if (!dimensions) {
      return undefined;
    }

    const capacityMatch = /^string<(\d+)>$/.exec(
      TypeResolver.getTypeName(parameter.type),
    );
    if (!capacityMatch) {
      return dimensions;
    }

    // Whether the capacity is present is structural, not something to infer
    // from the trailing value: a guard comparing it to `capacity + 1` misfires
    // for any `string<N>[N+1]` and silently declares a different type than the
    // .c defines. IParameterSymbol.arrayDimensions never carries the capacity --
    // FunctionCollector.collectParameters records only the declared dimensions --
    // so it is always appended here.
    return [...dimensions, String(Number.parseInt(capacityMatch[1], 10) + 1)];
  }

  /**
   * Resolve a parameter's array dimension that names a `const`.
   *
   * C-Next resolves const-sized arrays to their value rather than emitting a C
   * VLA, so the implementation writes `uint8_t grid[6][4]`. The header kept the
   * source text and wrote `grid[SIZE][4]`, which is a different declaration --
   * and in C++ not a constant expression at all, since SIZE is an `extern
   * const` there (#1164).
   *
   * Enum-qualified dimensions keep their own resolution path.
   */
  private static resolveConstDimension(dimension: string): string {
    const constValue = CodeGenState.constValues.get(dimension);
    return constValue === undefined ? dimension : String(constValue);
  }

  private static convertStruct(
    struct: import("../../../types/symbols/IStructSymbol").default,
  ): IHeaderSymbol {
    // Get transpiled C name (scope-prefixed)
    const cName = ScopeUtils.getTranspiledCName(struct);
    const isGlobal = ScopeUtils.isGlobalScopePath(struct.scopePath);

    return {
      name: cName,
      kind: "struct",
      parent: isGlobal ? undefined : struct.scopePath,
      sourceFile: struct.sourceFile,
      sourceLine: struct.span.line,
    };
  }

  private static convertEnum(
    enumSym: import("../../../types/symbols/IEnumSymbol").default,
  ): IHeaderSymbol {
    // Get transpiled C name (scope-prefixed)
    const cName = ScopeUtils.getTranspiledCName(enumSym);
    const isGlobal = ScopeUtils.isGlobalScopePath(enumSym.scopePath);

    return {
      name: cName,
      kind: "enum",
      parent: isGlobal ? undefined : enumSym.scopePath,
      sourceFile: enumSym.sourceFile,
      sourceLine: enumSym.span.line,
    };
  }

  private static convertBitmap(
    bitmap: import("../../../types/symbols/IBitmapSymbol").default,
  ): IHeaderSymbol {
    // Get transpiled C name (scope-prefixed)
    const cName = ScopeUtils.getTranspiledCName(bitmap);
    const isGlobal = ScopeUtils.isGlobalScopePath(bitmap.scopePath);

    return {
      name: cName,
      kind: "bitmap",
      type: bitmap.backingType,
      parent: isGlobal ? undefined : bitmap.scopePath,
      sourceFile: bitmap.sourceFile,
      sourceLine: bitmap.span.line,
    };
  }

  private static convertRegister(
    register: import("../../../types/symbols/IRegisterSymbol").default,
  ): IHeaderSymbol {
    // Get transpiled C name (scope-prefixed)
    const cName = ScopeUtils.getTranspiledCName(register);
    const isGlobal = ScopeUtils.isGlobalScopePath(register.scopePath);

    return {
      name: cName,
      kind: "register",
      parent: isGlobal ? undefined : register.scopePath,
      sourceFile: register.sourceFile,
      sourceLine: register.span.line,
    };
  }

  private static convertScope(
    scope: import("../../../types/symbols/IScopeSymbol").default,
  ): IHeaderSymbol {
    return {
      name: scope.name,
      kind: "scope",
      // #1298: a scope states where it sits, like every other kind converted
      // here. This literal used to omit `parent` entirely -- the shape with no
      // parent that `getScopePath`'s guard existed to catch, built deliberately,
      // and the one kind that could not say which scope contained it.
      parent: ScopeUtils.isGlobalScopePath(scope.scopePath)
        ? undefined
        : scope.scopePath,
      sourceFile: scope.sourceFile,
      sourceLine: scope.span.line,
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
   * Sharing `QualifiedCName.fromParts([])` is not sufficient on its own: both sides must
   * also agree on *what to join*. A bare `State.COUNT` written inside `scope Motor`
   * refers to `Motor.State.COUNT` and must become `Motor__State__COUNT`, while a
   * top-level `EColor.COUNT` must stay `EColor__COUNT`.
   *
   * @param dim - Dimension as written in source; may be a qualified enum access
   * @param scopePath - Path of the scope declaring the variable, "" at file scope
   * @returns C-compatible dimension string
   * @example resolveArrayDimension("EColor.COUNT", "") => "EColor__COUNT"
   * @example resolveArrayDimension("State.COUNT", "Motor") => "Motor__State__COUNT"
   * @example resolveArrayDimension("this.State.COUNT", "Motor") => "Motor__State__COUNT"
   * @example resolveArrayDimension("global.EColor.COUNT", "Motor") => "EColor__COUNT"
   * @example resolveArrayDimension("10", "Motor") => "10"
   */
  private static resolveArrayDimension(dim: string, scopePath: string): string {
    // Issue #1127: the rule itself lives on ScopeUtils so the struct-field path
    // applies the same one. This wrapper only binds the predicate.
    return ScopeUtils.resolveDimensionName(
      dim,
      scopePath,
      (qualified: string) => CodeGenState.isKnownEnum(qualified),
    );
  }
}

export default HeaderSymbolAdapter;
