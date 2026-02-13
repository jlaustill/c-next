/**
 * C-Next Function Symbol
 *
 * Represents a function in the C-Next type system with bare name and scope reference.
 *
 * Design decisions:
 * - `name` is the BARE function name (e.g., "fillData"), NOT C-mangled ("Test_fillData")
 * - `scope` is a reference to IScopeSymbol (never null - global scope is explicit)
 * - `parameters` uses IParameterInfo with TType
 * - `returnType` uses TType
 * - `body` holds AST reference (use `unknown` for now to avoid parser dependency)
 *
 * Use FunctionUtils for factory functions, type guards, and name mangling.
 */
import type IScopeSymbol from "./IScopeSymbol";
import type IParameterInfo from "./IParameterInfo";
import type TType from "./TType";
import type TVisibility from "./TVisibility";

/**
 * Function symbol representing a C-Next function
 */
interface IFunctionSymbol {
  /** Discriminator for symbol type */
  readonly kind: "function";

  /** Bare function name (e.g., "fillData", NOT "Test_fillData") */
  readonly name: string;

  /** Scope this function belongs to (never null - use global scope) */
  readonly scope: IScopeSymbol;

  /** Function parameters using IParameterInfo with TType */
  readonly parameters: ReadonlyArray<IParameterInfo>;

  /** Return type using TType discriminated union */
  readonly returnType: TType;

  /** Visibility within scope (public or private) */
  readonly visibility: TVisibility;

  /** AST reference for function body (unknown to avoid parser dependency) */
  readonly body: unknown;

  /** Source file where function is defined */
  readonly sourceFile: string;

  /** Line number in source file */
  readonly sourceLine: number;
}

export default IFunctionSymbol;
