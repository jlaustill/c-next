/**
 * Issue #1159: the one place that binds `ArrayDimensionParser` to the live
 * constant/type state.
 *
 * `ArrayDimensionParser` is deliberately pure — it takes its lookups as
 * options so it stays unit-testable without `CodeGenState`. That purity is
 * worth keeping, but it means every caller has to supply the same three
 * lookups, and a caller that supplies fewer silently resolves fewer dimension
 * forms than the others. That is how the `.c` came to fold a const in a
 * local declaration (`uint8_t b[6]`) while emitting the bare identifier in a
 * parameter (`uint8_t buf[SIZE]`) for the same const — a VLA parameter, which
 * CLAUDE.md rules out ("the transpiler resolves consts to their value, no C
 * VLA").
 *
 * Callers use this builder rather than assembling options inline, so a new
 * dimension form becomes resolvable everywhere at once.
 */

import TYPE_WIDTH from "../../transpiler/constants/TYPE_WIDTH";
import type TranspileState from "../TranspileState";
import type ISourcePosition from "../../utils/types/ISourcePosition";

const NO_CONST_VALUES: ReadonlyMap<string, number> = new Map();

/**
 * The constant-folding options for a dimension folded at `at`: the const
 * values visible there, as 1.4 settled them (#1664 box 7), and the type
 * widths `sizeof` needs.
 *
 * Render held one mutable map per file instead, seeded with every const under
 * its bare name and written as the walk passed a local const, so a local `N`
 * in one function sized another's `u8[N]`. Empty for a render with no
 * program behind it (a unit test that builds codegen state alone).
 */
function dimensionEvalOptions(state: TranspileState, at: ISourcePosition) {
  const typing = state.typingContext();
  return {
    constValues:
      typing === null
        ? NO_CONST_VALUES
        : typing.program.constValuesAt(typing.sourceFile, at),
    typeWidths: TYPE_WIDTH,
  };
}

export default dimensionEvalOptions;
