import IModuleDestinationFailure from "./IModuleDestinationFailure";

interface IModuleDestinationsOutcome {
  readonly failures: readonly IModuleDestinationFailure[];
  /** Non-test modules under `src/`. */
  readonly modules: number;
  /** Placement rows read from the map. */
  readonly rows: number;
  /** Rows reading `awaiting #NNNN`. */
  readonly awaiting: number;
}

export default IModuleDestinationsOutcome;
