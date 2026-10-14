import type ISourceGraph from "./ISourceGraph";

/**
 * What 1.1 Discover learned that a pass after 1.4 reads (#1991). Every artifact
 * from 1.2 on carries it forward, so 2.2, 2.3 and 3.1 read it from the pass
 * before them instead of from 1.1's graph.
 */
type TDiscoveryFacts = Pick<
  ISourceGraph,
  "cppMode" | "anchor" | "includes" | "outputs" | "headerMacroDumps" | "run"
>;

export default TDiscoveryFacts;
