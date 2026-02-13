/**
 * FunctionSymbolAdapter - Converts old-style IFunctionSymbol to new-style IFunctionSymbol.
 *
 * This adapter bridges the gap between the legacy symbol system (string-based types)
 * and the new TType-based system during the refactoring transition.
 */
import type OldIFunctionSymbol from "../logic/symbols/types/IFunctionSymbol";
import type OldIParameterInfo from "../logic/symbols/types/IParameterInfo";
import type NewIFunctionSymbol from "./IFunctionSymbol";
import type NewIParameterInfo from "./IParameterInfo";
import type IScopeSymbol from "./IScopeSymbol";
import TypeResolver from "./TypeResolver";
import FunctionUtils from "./FunctionUtils";
import ParameterUtils from "./ParameterUtils";
import ScopeUtils from "./ScopeUtils";

class FunctionSymbolAdapter {
  /**
   * Convert an old-style IFunctionSymbol to a new-style IFunctionSymbol.
   *
   * @param oldSymbol - The old-style function symbol with string types
   * @param scope - The scope this function belongs to (IScopeSymbol)
   * @param body - AST reference for the function body
   * @returns New-style IFunctionSymbol with TType
   */
  static toNew(
    oldSymbol: OldIFunctionSymbol,
    scope: IScopeSymbol,
    body: unknown,
  ): NewIFunctionSymbol {
    const bareName = FunctionSymbolAdapter.extractBareName(
      oldSymbol.name,
      scope,
    );
    const returnType = TypeResolver.resolve(oldSymbol.returnType);
    const parameters = oldSymbol.parameters.map((param) =>
      FunctionSymbolAdapter.convertParameter(param),
    );

    return FunctionUtils.create({
      name: bareName,
      scope,
      parameters,
      returnType,
      visibility: oldSymbol.visibility,
      body,
      sourceFile: oldSymbol.sourceFile,
      sourceLine: oldSymbol.sourceLine,
    });
  }

  /**
   * Extract the bare function name from a C-mangled name.
   *
   * For "Test_fillData" with scope "Test", returns "fillData".
   * For "Test_Helper_func" with scope "Test.Helper" (nested), returns "func".
   * For "main" with global scope (name ""), returns "main".
   *
   * @param mangledName - The C-mangled function name (e.g., "Test_fillData")
   * @param scope - The scope symbol
   * @returns The bare function name
   */
  static extractBareName(mangledName: string, scope: IScopeSymbol): string {
    // Global scope: return name as-is
    if (ScopeUtils.isGlobalScope(scope)) {
      return mangledName;
    }

    // Build scope prefix from outermost to innermost
    const scopePath = ScopeUtils.getScopePath(scope);
    const prefix = scopePath.join("_") + "_";

    // If the mangled name starts with the prefix, strip it
    if (mangledName.startsWith(prefix)) {
      return mangledName.slice(prefix.length);
    }

    // Fallback: return as-is (shouldn't happen with valid symbols)
    return mangledName;
  }

  /**
   * Convert an old-style IParameterInfo to a new-style IParameterInfo.
   *
   * @param oldParam - The old-style parameter with string type
   * @returns New-style IParameterInfo with TType
   */
  static convertParameter(oldParam: OldIParameterInfo): NewIParameterInfo {
    const type = TypeResolver.resolve(oldParam.type);

    // Convert string[] to (number | string)[] for array dimensions
    const arrayDimensions = oldParam.arrayDimensions
      ? FunctionSymbolAdapter._convertArrayDimensions(oldParam.arrayDimensions)
      : undefined;

    return ParameterUtils.create(
      oldParam.name,
      type,
      oldParam.isConst,
      arrayDimensions,
    );
  }

  /**
   * Convert old string[] array dimensions to new (number | string)[] format.
   * Numeric strings become numbers, non-numeric strings pass through.
   */
  private static _convertArrayDimensions(
    dimensions: string[],
  ): (number | string)[] {
    return dimensions.map((dim) => {
      const num = Number.parseInt(dim, 10);
      return Number.isNaN(num) ? dim : num;
    });
  }
}

export default FunctionSymbolAdapter;
