/**
 * The run's settings, as 1.1 Discover returns them on the `SourceGraph`
 * (#1991): a later pass reads them from what the pass before it returned,
 * never from the host's configuration.
 */
interface IRunSettings {
  readonly debugMode: boolean;
  /** Analyze nothing, plan nothing: 2.1 only keeps declaration counts */
  readonly parseOnly: boolean;
  /**
   * #1844: unset is not false. Unset, C++ in a header makes the run C++;
   * `false` asked for C, and C++ met there is E0507.
   */
  readonly cppRequired?: boolean;
  /** ADR-049's command-line rungs; 1.2 settles the target (#1713) */
  readonly target: {
    readonly option?: string;
    readonly pioEnv?: string;
  };
}

export default IRunSettings;
