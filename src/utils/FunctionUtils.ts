/**
 * Factory functions and utilities for IFunctionSymbol.
 *
 * Provides utilities for creating and inspecting C-Next functions.
 * Scope-qualified C names come from ScopeUtils.getTranspiledCName.
 */
import type IFunctionSymbol from "../transpiler/types/symbols/IFunctionSymbol";
import type TVisibility from "../transpiler/types/TVisibility";
import type IParameterInfo from "../transpiler/types/symbols/IParameterInfo";
import type TType from "../transpiler/types/TType";
import ESourceLanguage from "./types/ESourceLanguage";
import ScopeUtils from "./ScopeUtils";
import type ISourceSpan from "../transpiler/types/ISourceSpan";

/**
 * Options for creating a function symbol
 */
interface IFunctionCreateOptions {
  name: string;
  scopePath: string;
  parameters: ReadonlyArray<IParameterInfo>;
  returnType: TType;
  visibility: TVisibility;
  body: unknown;
  sourceFile: string;
  span: ISourceSpan;
}

class FunctionUtils {
  // ============================================================================
  // Factory Functions
  // ============================================================================

  /**
   * Create a function symbol with the given properties.
   *
   * @param options - Function properties including bare name and scope path
   */
  static create(options: IFunctionCreateOptions): IFunctionSymbol {
    return {
      kind: "function",
      name: options.name,
      scopePath: options.scopePath,
      // #1285: identity computed once, here, from the enclosing path.
      ...ScopeUtils.identityOf({
        name: options.name,
        scopePath: options.scopePath,
      }),
      parameters: options.parameters,
      returnType: options.returnType,
      visibility: options.visibility,
      body: options.body,
      sourceFile: options.sourceFile,
      span: options.span,
      sourceLanguage: ESourceLanguage.CNext,
    };
  }

  // ============================================================================
  // Type Guards and Queries
  // ============================================================================

  /**
   * Check if function is in the global scope.
   */
  static isInGlobalScope(func: IFunctionSymbol): boolean {
    return ScopeUtils.isGlobalScopePath(func.scopePath);
  }
}

export default FunctionUtils;
