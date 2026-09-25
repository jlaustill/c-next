import TranspileState from "../../TranspileState";
import Program from "../../../PARSE/4-Resolve/Program";
import type IAnalysisContext from "../types/IAnalysisContext";
import createMockSymbols from "../../../transpiler/__tests__/codeGenSymbolsHelpers";

/**
 * An `IAnalysisContext` built from whatever the test already put on
 * `TranspileState`.
 *
 * #1456 made the analyzers take their inputs instead of reaching for them.
 * Production builds this in `Transpiler._analyzeFile`, from the artifacts it
 * is holding. The unit tests set the same facts up on `TranspileState` and have
 * done since before the boundary existed, so this reads them back rather than
 * rewriting several hundred assertions to construct symbol views by hand.
 *
 * That is deliberate and it is not a fallback: nothing in `src/` outside
 * `__tests__` calls this, so the production path cannot reach `TranspileState`
 * through it. A test that wants a specific view passes its own object.
 *
 * `program` is non-nullable on the context because 1.4 Resolve has always
 * finished before 2.1 begins, so an empty `Program` stands in for a test that
 * never set one -- which is what those tests were getting from the `?? []`
 * fallbacks this replaced, only now it is stated rather than implied.
 */
const testAnalysisContext = (
  state: TranspileState,
  overrides: Partial<IAnalysisContext> = {},
): IAnalysisContext => ({
  symbols: state.symbols ?? createMockSymbols(),
  program: state.program ?? Program.build([], {}),
  symbolTable: state.symbolTable,
  reachesForeignHeader: state.currentFileReachesForeignHeader,
  ...overrides,
});

export default testAnalysisContext;
