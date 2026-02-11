/**
 * Test mode types for dual-mode testing (C and C++)
 */

/**
 * The compilation mode for a test
 */
export type TTestMode = "c" | "cpp";

/**
 * Result of running a test in a single mode (C or C++)
 */
export interface IModeResult {
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
}
