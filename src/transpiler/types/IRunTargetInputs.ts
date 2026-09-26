import type ITargetDescription from "./ITargetDescription";
import type ITargetDirective from "./ITargetDirective";

/**
 * ADR-049: what 1.4 Resolve settles the run's one target from.
 */
interface IRunTargetInputs {
  /** The target option (`--target`, defaulted by the config's `target`) */
  readonly option?: string;
  /** Every name the target catalog defines, to its description */
  readonly catalog: ReadonlyMap<string, ITargetDescription>;
  /** Each file's `#pragma` lines, in pipeline order */
  readonly files: readonly {
    readonly sourcePath: string;
    readonly directives: readonly ITargetDirective[];
  }[];
}

export default IRunTargetInputs;
