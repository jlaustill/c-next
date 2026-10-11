import type IDeclaredCall from "./IDeclaredCall";

/**
 * What ONE FILE's functions do to their own parameters (#1825): ADR-006's
 * per-file half, collected by 1.3 Declare.
 *
 * Every map is keyed by the function's transpiled C name. What a callee does
 * with a parameter it is passed is NOT here: the callee is routinely in another
 * file, so propagating a modification along a call is 1.4 Resolve's, and so is
 * resolving a bare callee name (see `IDeclaredCall`).
 */
interface IFileModifications {
  /** Each function's parameter names, in declaration order. */
  readonly functionParamLists: ReadonlyMap<string, ReadonlyArray<string>>;
  /** The parameters each function assigns to directly. */
  readonly modifiedParameters: ReadonlyMap<string, ReadonlySet<string>>;
  /** Each call a function passes one of its parameters to, in source order. */
  readonly calls: ReadonlyMap<string, ReadonlyArray<IDeclaredCall>>;
}

export default IFileModifications;
