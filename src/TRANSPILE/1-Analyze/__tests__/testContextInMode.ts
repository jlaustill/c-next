import type IAnalysisContext from "../types/IAnalysisContext";

/**
 * #1428: a 2.1 context whose program carries a stated run mode.
 *
 * A run's program carries 1.1's answer and analyzers read it from there. A unit
 * test has no 1.1, so it states the mode -- required, never defaulted -- and
 * gets a context whose `program.cppMode()` answers it. Everything else is the
 * context it was handed.
 */
function testContextInMode(
  context: IAnalysisContext,
  cppMode: boolean,
): IAnalysisContext {
  return {
    ...context,
    program: { ...context.program, cppMode: () => cppMode },
  };
}

export default testContextInMode;
