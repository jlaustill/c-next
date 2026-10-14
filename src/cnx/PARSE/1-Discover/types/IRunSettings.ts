/**
 * The run's settings, as 1.1 Discover returns them on the `SourceGraph`
 * (#1991): a later pass reads them from what the pass before it returned,
 * never from the host's configuration.
 */
interface IRunSettings {
  readonly debugMode: boolean;
  /** Analyze nothing, plan nothing: the run stops after 1.4 */
  readonly parseOnly: boolean;
  /** ADR-049's command-line rungs; 1.4 settles the target */
  readonly target: {
    readonly option?: string;
    readonly pioEnv?: string;
  };
}

export default IRunSettings;
