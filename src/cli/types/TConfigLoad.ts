import type IFileConfig from "./IFileConfig";
import type IRenamedConfigErrors from "./IRenamedConfigErrors";

/**
 * `ConfigLoader.load`'s answer: the config the walk found (empty when it found
 * none), or the E0918s that stop the run.
 */
type TConfigLoad =
  | IRenamedConfigErrors
  | { readonly kind: "loaded"; readonly config: IFileConfig };

export default TConfigLoad;
