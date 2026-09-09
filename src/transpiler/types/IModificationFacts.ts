import type ICallGraphEntry from "./ICallGraphEntry";

/**
 * What the whole program does to its function parameters.
 *
 * Three facts that are cross-file by nature: whether a callee modifies a
 * parameter decides whether its caller's argument may take ADR-013 auto-const,
 * and the callee is routinely in another file.
 *
 * They used to be accumulated. Each file was analyzed with the running total
 * injected first, its own contribution extracted back out, and the global maps
 * saved and restored around the whole thing — so the answer to "does this
 * callee modify its parameter?" depended on how many files had been processed
 * when it was asked. Derived once over every tree instead, and handed to
 * `Program`, which is the artifact later passes read (#1511).
 */
interface IModificationFacts {
  /** Function name to the names of the parameters it modifies. */
  readonly modifiedParameters: ReadonlyMap<string, ReadonlySet<string>>;

  /** Function name to its parameter names, in declaration order. */
  readonly functionParamLists: ReadonlyMap<string, ReadonlyArray<string>>;

  /** Caller to the calls it makes, for transitive propagation. */
  readonly callGraph: ReadonlyMap<string, ReadonlyArray<ICallGraphEntry>>;
}

export default IModificationFacts;
