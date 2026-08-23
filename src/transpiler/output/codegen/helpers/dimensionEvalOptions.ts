/**
 * Issue #1159: the one place that binds `ArrayDimensionParser` to the live
 * constant/type state.
 *
 * `ArrayDimensionParser` is deliberately pure — it takes its lookups as
 * options so it stays unit-testable without `CodeGenState`. That purity is
 * worth keeping, but it means every caller has to supply the same three
 * lookups, and a caller that supplies fewer silently resolves fewer dimension
 * forms than its neighbours. That is how the `.c` came to fold a const in a
 * local declaration (`uint8_t b[6]`) while emitting the bare identifier in a
 * parameter (`uint8_t buf[SIZE]`) for the same const — a VLA parameter, which
 * CLAUDE.md rules out ("the transpiler resolves consts to their value, no C
 * VLA").
 *
 * Callers use this builder rather than assembling options inline, so a new
 * dimension form becomes resolvable everywhere at once.
 */

import CodeGenState from "../../../state/CodeGenState";
import TYPE_WIDTH from "../../../constants/TYPE_WIDTH";

/**
 * Build the constant-folding options for an array dimension from current state.
 */
function dimensionEvalOptions() {
  return {
    constValues: CodeGenState.constValues,
    typeWidths: TYPE_WIDTH,
    isKnownStruct: (name: string) => CodeGenState.isKnownStruct(name),
  };
}

export default dimensionEvalOptions;
