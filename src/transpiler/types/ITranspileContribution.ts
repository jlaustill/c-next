import ICodeGenSymbols from "./ICodeGenSymbols";

/**
 * Data contributed by transpiling a single file.
 *
 * When run() delegates to transpileSource(), each file transpilation
 * produces these contributions that run() accumulates:
 *
 * - symbolInfo: For header generation (Issue #220)
 * - passByValueParams: For header parameter optimization (Issue #280)
 * - userIncludes: For header include directives (Issue #424)
 * - modifiedParameters: For C++ const inference accumulation (Issue #558)
 * - functionParamLists: For C++ const inference transitive propagation
 */
interface ITranspileContribution {
  /** Symbol info collected from this file (for header generation) */
  readonly symbolInfo: ICodeGenSymbols;

  /** Pass-by-value parameters: funcName -> Set of param names */
  readonly passByValueParams: ReadonlyMap<string, ReadonlySet<string>>;

  /** User .cnx includes transformed to .h (for header generation) */
  readonly userIncludes: readonly string[];

  /** Modified parameters in this file (C++ mode only) */
  readonly modifiedParameters?: ReadonlyMap<string, Set<string>>;

  /** Function parameter lists in this file (C++ mode only) */
  readonly functionParamLists?: ReadonlyMap<string, readonly string[]>;
}

export default ITranspileContribution;
