/**
 * Test execution options for CI optimization
 *
 * These flags allow splitting the test pipeline:
 * - transpileOnly: Only run transpilation + snapshot comparison (no compile/execute)
 * - executeOnly: Skip transpilation, assume .test.c files exist (compile/execute only)
 */
interface ITestOptions {
  transpileOnly?: boolean;
  executeOnly?: boolean;
}

export default ITestOptions;
