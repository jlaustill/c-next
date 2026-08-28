/**
 * Factory functions and utilities for IFunctionSymbol.
 *
 * Provides utilities for creating and inspecting C-Next functions.
 * Scope-qualified C names come from ScopeUtils.getTranspiledCName.
 */
import type IFunctionSymbol from "../transpiler/types/symbols/IFunctionSymbol";
import type TVisibility from "../transpiler/types/TVisibility";
import type IScopeSymbol from "../transpiler/types/symbols/IScopeSymbol";
import type IParameterInfo from "../transpiler/types/symbols/IParameterInfo";
import type TType from "../transpiler/types/TType";
import ESourceLanguage from "./types/ESourceLanguage";
import ScopeUtils from "./ScopeUtils";

/**
 * Options for creating a function symbol
 */
interface IFunctionCreateOptions {
  name: string;
  scope: IScopeSymbol;
  parameters: ReadonlyArray<IParameterInfo>;
  returnType: TType;
  visibility: TVisibility;
  body: unknown;
  sourceFile: string;
  sourceLine: number;
}

class FunctionUtils {
  // ============================================================================
  // Factory Functions
  // ============================================================================

  /**
   * Create a function symbol with the given properties.
   *
   * @param options - Function properties including bare name and scope reference
   */
  static create(options: IFunctionCreateOptions): IFunctionSymbol {
    return {
      kind: "function",
      name: options.name,
      scope: options.scope,
      // #1285: identity computed once, here, from the scope chain.
      ...ScopeUtils.identityOf({
        name: options.name,
        scope: options.scope,
      }),
      parameters: options.parameters,
      returnType: options.returnType,
      visibility: options.visibility,
      body: options.body,
      sourceFile: options.sourceFile,
      sourceLine: options.sourceLine,
      sourceLanguage: ESourceLanguage.CNext,
      isExported: options.visibility === "public",
    };
  }

  // ============================================================================
  // Type Guards and Queries
  // ============================================================================

  /**
   * Check if function has public visibility.
   */
  static isPublic(func: IFunctionSymbol): boolean {
    return func.visibility === "public";
  }

  /**
   * Check if function is in the global scope.
   */
  static isInGlobalScope(func: IFunctionSymbol): boolean {
    return ScopeUtils.isGlobalScope(func.scope);
  }
}

export default FunctionUtils;
