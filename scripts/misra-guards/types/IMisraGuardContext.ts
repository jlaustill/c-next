/** What the guards are checked against, read from the repository. */
interface IMisraGuardContext {
  /** Rules `validate:c` baselines (`MisraBaseline.BASELINE`) */
  readonly baselined: ReadonlySet<string>;
  /** Rules `validate:c` reads from the dump (`MisraDump.RULES`) */
  readonly dumpRules: readonly string[];
  /** Source of the integration compile (scripts/test-utils.ts) */
  readonly compileSource: string;
  /** Every error code some `.expected.error` asserts */
  readonly assertedCodes: ReadonlySet<string>;
  /** package.json's scripts */
  readonly scripts: ReadonlySet<string>;
}

export default IMisraGuardContext;
