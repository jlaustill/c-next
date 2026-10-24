/** What the guards are checked against, read from the repository. */
interface IMisraGuardContext {
  /** Rules `validate:c` baselines (`MisraBaseline.BASELINE`) */
  readonly baselined: ReadonlySet<string>;
  /** Rules `validate:c` reads from the dump (`MisraDump.RULES`) */
  readonly dumpRules: readonly string[];
  /**
   * What the integration compile printed for a C++ unit that uses a literal
   * `0` as a null pointer -- the diagnostics a compile-flag guard must be in
   */
  readonly compileProbe: string;
  /** Which of the issues the registry names are open */
  readonly openIssues: ReadonlySet<number>;
  /** Every error code some `.expected.error` asserts */
  readonly assertedCodes: ReadonlySet<string>;
  /** package.json's scripts */
  readonly scripts: ReadonlySet<string>;
}

export default IMisraGuardContext;
