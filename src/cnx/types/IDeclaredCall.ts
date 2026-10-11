import type ICallGraphEntry from "./ICallGraphEntry";

/**
 * One call as 1.3 Declare records it: a parameter of the calling function,
 * passed to a callee (#1825).
 *
 * A call written with a bare name (`fill(buf)`) is recorded as written, not
 * resolved. Inside a scope, ADR-057 makes it the scope's own `fill` when the
 * scope declares one and the global `fill` otherwise -- and a scope can be
 * reopened in another file (#1333), so one file's parse cannot say which. 1.4
 * Resolve answers it, against every file's declarations. A qualified call
 * (`Scope.fill(buf)`, `this.fill(buf)`, `global.fill(buf)`) states its answer
 * in the syntax, so its callee is already the transpiled C name.
 */
interface IDeclaredCall extends ICallGraphEntry {
  /** The source wrote a bare callee name, which 1.4 still has to resolve. */
  readonly calleeIsBare: boolean;
}

export default IDeclaredCall;
