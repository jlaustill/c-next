import type IRenamedConfigFile from "../../../types/IRenamedConfigFile";

/**
 * The walk from a directory up to its project root (#2165): the root, and
 * every config under an old name the walk passed, which is E0918.
 */
interface IProjectRootWalk {
  /** The nearest directory holding a project marker, or null at none. */
  readonly root: string | null;

  readonly renamedConfigs: readonly IRenamedConfigFile[];
}

export default IProjectRootWalk;
