import type TTestMode from "./TTestMode";

/**
 * One target of a `// test-target-xfail` marker (#1668 box 12): that target's
 * cell must fail until `issue` is fixed.
 */
interface ITargetXfail {
  /** The catalog name the marker's target resolves to (aliases resolved) */
  readonly target: string;
  /** The one mode the marker covers, or every mode when it names none */
  readonly mode?: TTestMode;
  readonly issue: number;
  /**
   * The text the cell's failure must contain, when the marker quotes one
   * (#1760 second review): a cell failing for any other reason -- a crash, a
   * new error -- is not the expected failure, and is reported
   */
  readonly expect?: string;
}

export default ITargetXfail;
