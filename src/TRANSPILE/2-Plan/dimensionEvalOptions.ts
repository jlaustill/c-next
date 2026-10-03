/**
 * Issue #1159: the one place that binds the constant evaluator to the live
 * constant/type state.
 *
 * `ConstantEvaluator` is deliberately pure — it takes its names through an
 * environment so it stays unit-testable without the state. That purity is
 * worth keeping, but it means every caller has to supply the same
 * environment, and a caller that supplies a narrower one silently resolves
 * fewer dimension forms than the others. That is how the `.c` came to fold a const in a
 * local declaration (`uint8_t b[6]`) while emitting the bare identifier in a
 * parameter (`uint8_t buf[SIZE]`) for the same const — a VLA parameter, which
 * CLAUDE.md rules out ("the transpiler resolves consts to their value, no C
 * VLA").
 *
 * Callers use this builder rather than assembling options inline, so a new
 * dimension form becomes resolvable everywhere at once.
 */

import ConstantFold from "../../utils/ConstantFold";
import type TranspileState from "../TranspileState";
import type IConstantEnvironment from "../../utils/types/IConstantEnvironment";

/**
 * What a name in a dimension is worth where it is written, as 1.4 settled it
 * (#1664 box 7). #1175: each name carries its own position, so the file is
 * all this needs -- the position the options were built at is gone.
 *
 * Render held one mutable map per file instead, seeded with every const under
 * its bare name and written as the walk passed a local const, so a local `N`
 * in one function sized another's `u8[N]`.
 */
function dimensionEvalOptions(state: TranspileState): IConstantEnvironment {
  const typing = state.typingContext();
  return ConstantFold.environment(typing.program, typing.sourceFile);
}

export default dimensionEvalOptions;
