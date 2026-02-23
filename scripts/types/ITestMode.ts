/**
 * Test mode types for dual-mode testing (C and C++)
 */

import TTestMode from "./TTestMode";

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
  error?: string;
  expected?: string;
  actual?: string;
  /** Captured stdout from execution (for parity comparison) */
  stdout?: string;
}

export default IModeResult;
