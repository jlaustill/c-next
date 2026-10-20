import ICodeGenSymbols from "../../types/ICodeGenSymbols";
import type ITargetDescription from "../../types/ITargetDescription";
import type EFileType from "../../PARSE/1-Discover/types/EFileType";
import type IProgram from "../../types/IProgram";
import type IHeaderSetup from "./IHeaderSetup";

/**
 * 2.2's options for one file. `PlanOptions.of` is the only producer: it reads
 * each from the artifact 2.1 returned (#1991), so every field is set.
 */
interface ICodeGeneratorOptions {
  /** 2.1's program, which 2.2 and 2.3 read cross-file facts from (#1991) */
  program: IProgram;
  /** What 2.3 captures the file's header from */
  header: IHeaderSetup;
  /** ADR-044: When true, generate panic helpers instead of clamp helpers */
  debugMode: boolean;
  /**
   * ADR-055: Pre-collected symbol info from CNextResolver + TSymbolInfoAdapter.
   * Required (#1428, ruling 22): codegen never collects symbols itself.
   *
   * There is no `cppMode` here. The run's mode is 1.1's answer, read from
   * `Program` (#1428), so no caller can claim one by leaving it out.
   */
  symbolInfo: ICodeGenSymbols;
  /**
   * ADR-049: the target this file is generated for, which 1.4 settled on the
   * program. Codegen never resolves a target itself.
   */
  targetDescription: ITargetDescription;
  /** ADR-010: Source file path for validating includes */
  sourcePath: string;
  /**
   * How the `.c` names its own header, which 1.1 settled (#339, #2272/#1473):
   * relative to the `.c`, e.g. `"Utils.h"` for Display/Utils.c.
   */
  selfInclude: string;
  /**
   * Issue #1467: author spelling -> resolved header path, decided once by
   * PathResolver during discovery.
   *
   * Replaces the `includeDirs`/`inputs` pair added for #349. Those declared a
   * path resolution inside codegen that the only production caller never
   * supplied, so the resolution was dead for the whole pipeline while the
   * options advertised it.
   */
  includeRewrites: ReadonlyMap<string, string>;
  /**
   * #1444, owner ruling 1: the kind of file each `#include` directive's
   * spelling names, keyed by `IncludeDirectiveText.join`, as 1.1 Discover
   * classified it. Render rewrites a directive only when this says C-Next,
   * and classifies nothing itself.
   */
  includeKinds: ReadonlyMap<string, EFileType>;
  /**
   * Issue #1515: whether this file has a public C interface, so the generated
   * `.c` must include its own header.
   *
   * 2.2 decides it: `PlanOptions.of` asks `PublicInterface`, which owns the
   * rule, about the file's symbols in 1.4's table, read off the artifact 2.2
   * is handed. It used to ride on `ICodeGenSymbols`, computed by
   * `TSymbolInfoAdapter` in 1.3 Declare -- making the earliest pass in the
   * pipeline the author of an emission decision.
   */
  hasPublicInterface: boolean;
}

export default ICodeGeneratorOptions;
