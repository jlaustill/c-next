import type IFileSetup from "./IFileSetup";

/** #1991: what 2.2 reads off the options before it plans anything */
type TPlanInputs = Pick<
  IFileSetup,
  | "program"
  | "symbols"
  | "sourcePath"
  | "debugMode"
  | "cppMode"
  | "targetDescription"
  | "includeRewrites"
  | "includeKinds"
  | "scopeMembers"
>;

export default TPlanInputs;
