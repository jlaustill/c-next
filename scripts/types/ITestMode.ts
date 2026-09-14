/**
 * Test mode types for dual-mode testing (C and C++)
 */

import TTestMode from "./TTestMode";
import TExecSkipReason from "./TExecSkipReason";

/**
 * Result of running a test in a single mode (C or C++)
 */
interface IModeResult {
  mode: TTestMode;
  transpileSuccess: boolean;
  snapshotMatch: boolean;
  headerMatch: boolean;
  compileSuccess: boolean;
  execSuccess: boolean;
  skippedExec?: boolean;
  /** Why execution was skipped (Issue #1397). Set wherever skippedExec is. */
  skipReason?: TExecSkipReason;
  error?: string;
  expected?: string;
  actual?: string;
  /** Captured stdout from execution (for parity comparison) */
  stdout?: string;
  /**
   * #1544: what this run wrote for each file it generated for a DEPENDENCY,
   * as `absolute path -> sha256`.
   *
   * A dependency's generated files belong to the program that included them,
   * so two fixtures sharing a helper must agree on its bytes or the committed
   * file is whichever ran last. Hashing what the run already wrote costs no
   * extra transpile; the comparison across fixtures happens in the parent,
   * which is the only place that sees more than one.
   */
  dependencyDigests?: Record<string, string>;
}

export default IModeResult;
