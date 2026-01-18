/**
 * Result of running a single test
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
}

export default ITestResult;
