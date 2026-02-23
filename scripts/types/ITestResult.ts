import type IModeResult from "./ITestMode";

/**
 * Result of running a single test
 *
 * For dual-mode tests, results from both C and C++ modes are tracked separately.
 * The overall `passed` field is true only if all enabled modes pass.
 */
interface ITestResult {
  passed: boolean;
  message?: string;
  expected?: string;
  actual?: string;
  updated?: boolean;
  skippedExec?: boolean;
  noSnapshot?: boolean;
  execError?: string;
  warningError?: string;

  // Dual-mode result tracking
  /** Results for C mode (if run) */
  cResult?: IModeResult;
  /** Results for C++ mode (if run) */
  cppResult?: IModeResult;
  /** Whether C mode was skipped (test-cpp-only marker) */
  cSkipped?: boolean;
  /** Whether C++ mode was skipped (test-c-only marker) */
  cppSkipped?: boolean;

  // Parity tracking (Issue #922)
  /** Whether parity was checked (both modes ran with execution) */
  parityChecked?: boolean;
  /** Whether outputs matched between C and C++ modes */
  parityPassed?: boolean;
  /** Details of parity mismatch (stdout differences) */
  parityError?: string;
}

export default ITestResult;
