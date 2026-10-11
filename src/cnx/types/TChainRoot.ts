/**
 * ADR-016's three spellings, as the one value that distinguishes them.
 *
 * #1322. A member chain is written bare (`x.y`), rooted at the enclosing scope
 * (`this.x.y`), or rooted at file scope (`global.x.y`). Every rule that walks a
 * chain has to know which, because the three read the chain from different
 * offsets and search different scopes.
 *
 * The union was written out inline at four sites before this existed, which is
 * how `ScopeCandidates.forRoot` came to accept a parameter no caller could name.
 * `ChainRoot` is the one place that reads it off a node.
 */
type TChainRoot = "this" | "global" | null;

export default TChainRoot;
