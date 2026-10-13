import type TDiscoveryFacts from "../../1-Discover/types/TDiscoveryFacts";
import type IParsedTargetCatalog from "../../2-Parse/types/IParsedTargetCatalog";
import type ITranspileError from "../../../types/ITranspileError";
import type IDeclaredSource from "./IDeclaredSource";

/** 1.3's artifact (#1991): each file it declared, the others' errors, and 1.2's carried facts */
interface IDeclaredSources {
  readonly declared: readonly IDeclaredSource[];
  readonly errors: readonly ITranspileError[];
  readonly targetCatalog: IParsedTargetCatalog;
  readonly discovery: TDiscoveryFacts;
}

export default IDeclaredSources;
