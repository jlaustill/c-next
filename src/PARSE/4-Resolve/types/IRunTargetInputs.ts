import type ITargetDescription from "../../../types/ITargetDescription";
import type ITargetDirective from "../../../types/ITargetDirective";
import type IPlatformIOProject from "../../../types/IPlatformIOProject";

/**
 * ADR-049: what 1.4 Resolve settles the run's one target from.
 */
interface IRunTargetInputs {
  /** The target option (`--target`, defaulted by the config's `target`) */
  readonly option?: string;
  /** Every name the target catalog defines, to its description */
  readonly catalog: ReadonlyMap<string, ITargetDescription>;
  /** The platformio.ini above the entry file, if any */
  readonly platformio?: IPlatformIOProject | null;
  /** The PlatformIO environment being built (`--pio-env`) */
  readonly pioEnv?: string;
  /** Each file's `#pragma` lines, in pipeline order */
  readonly files: readonly {
    readonly sourcePath: string;
    readonly directives: readonly ITargetDirective[];
  }[];
}

export default IRunTargetInputs;
