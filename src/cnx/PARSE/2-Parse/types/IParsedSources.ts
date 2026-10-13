import type TDiscoveryFacts from "../../1-Discover/types/TDiscoveryFacts";
import type ITranspileError from "../../../types/ITranspileError";
import type IParsedSource from "./IParsedSource";
import type IParsedTargetCatalog from "./IParsedTargetCatalog";

/** 1.2's artifact (#1991): each file that parsed, the others' errors, and 1.1's facts carried on */
interface IParsedSources {
  readonly sources: readonly IParsedSource[];
  readonly errors: readonly ITranspileError[];
  readonly targetCatalog: IParsedTargetCatalog;
  readonly discovery: TDiscoveryFacts;
}

export default IParsedSources;
