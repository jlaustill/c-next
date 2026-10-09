import type IPipelineFile from "../../../PARSE/1-Discover/types/IPipelineFile";
import type IFileSymbols from "../../../types/IFileSymbols";
import type ITargetDirective from "../../../types/ITargetDirective";

/**
 * What `TreePasses` hands the host for 1.4 Resolve: one declared file, as
 * plain data. The tree it was declared from stays inside `TreePasses` (#1932).
 */
interface IDeclaredSource {
  readonly file: IPipelineFile;
  readonly fileSymbols: IFileSymbols;
  readonly targetDirectives: readonly ITargetDirective[];
}

export default IDeclaredSource;
