import ICodeGenSymbols from "../../../../types/ICodeGenSymbols";
import type ITargetDescription from "../../../../types/ITargetDescription";
import type EFileType from "../../../../PARSE/1-Discover/types/EFileType";

/**
 * Options for the code generator
 */
interface ICodeGeneratorOptions {
  /** ADR-044: When true, generate panic helpers instead of clamp helpers */
  debugMode?: boolean;
  /**
   * ADR-055: Pre-collected symbol info from CNextResolver + TSymbolInfoAdapter.
   * Required (#1428, ruling 22): codegen never collects symbols itself.
   *
   * There is no `cppMode` here. The run's mode is 1.1's answer, read from
   * `Program` (#1428), so no caller can claim one by leaving it out.
   */
  symbolInfo: ICodeGenSymbols;
  /**
   * ADR-049: the target this file is generated for, decided by the
   * orchestrator before codegen. Required, like `symbolInfo`: codegen never
   * resolves a target itself.
   */
  targetDescription?: ITargetDescription;
  /** ADR-010: Source file path for validating includes */
  sourcePath?: string;
  /**
   * Issue #339: Relative path from source root to source file for self-include.
   * When set, self-includes will use this relative path instead of just the basename.
   * Example: "Display/Utils.cnx" -> #include "Display/Utils.h"
   */
  sourceRelativePath?: string;
  /**
   * Issue #1467: author spelling -> resolved header path, decided once by
   * PathResolver during discovery.
   *
   * Replaces the `includeDirs`/`inputs` pair added for #349. Those declared a
   * path resolution inside codegen that the only production caller never
   * supplied, so the resolution was dead for the whole pipeline while the
   * options advertised it.
   */
  cnxIncludeRewrites?: ReadonlyMap<string, string>;
  /**
   * #1444, owner ruling 1: the kind of file each `#include` directive's
   * spelling names, keyed by `IncludeDirectiveText.join`, as 1.1 Discover
   * classified it. Render rewrites a directive only when this says C-Next,
   * and classifies nothing itself.
   */
  includeKinds?: ReadonlyMap<string, EFileType>;
  /**
   * Issue #1515: whether this file has a public C interface, so the generated
   * `.c` must include its own header.
   *
   * Decided by `PublicInterface`, which owns the rule, and passed IN rather
   * than looked up. It used to ride on `ICodeGenSymbols`, computed by
   * `TSymbolInfoAdapter` in 1.3 Declare -- making the earliest pass in the
   * pipeline the author of an emission decision, and a `PARSE -> TRANSPILE`
   * edge the moment `PublicInterface` was placed in 2.2 Plan.
   *
   * Asking the run-wide symbol table here instead was tried and is worse: it
   * makes `generate()` depend on global state for a fact about the file it was
   * handed, so a caller that supplies `symbolInfo` and a `sourcePath` no longer
   * gets a self-contained answer. The caller knows; the caller says.
   */
  hasPublicInterface?: boolean;
}

export default ICodeGeneratorOptions;
