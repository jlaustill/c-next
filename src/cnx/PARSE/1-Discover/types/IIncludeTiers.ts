import type IProjectRootWalk from "./IProjectRootWalk";

/**
 * What `IncludeDiscovery.discoverIncludePaths` finds from one directory: the
 * discovered tiers of its search path, and the project-root walk they came
 * from, which discovery reports the walk's E0918s from (#2165).
 */
interface IIncludeTiers {
  readonly paths: readonly string[];
  readonly projectRoot: IProjectRootWalk;
}

export default IIncludeTiers;
