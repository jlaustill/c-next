/**
 * Test execution options.
 *
 * - transpileOnly: Only run transpilation + snapshot comparison (no compile/execute).
 *   Useful as a fast local check. The full pipeline (transpile + compile + execute)
 *   is the default and is what CI runs, so every test-execution test is always
 *   re-transpiled in the same pass that compiles and runs it (Issue #1018).
 */
interface ITestOptions {
  transpileOnly?: boolean;
}

export default ITestOptions;
