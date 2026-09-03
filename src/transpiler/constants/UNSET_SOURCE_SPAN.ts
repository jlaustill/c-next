import type ISourceSpan from "../types/ISourceSpan";

/**
 * Issue #1318: the span a scope carries before any declaring block has been
 * collected.
 *
 * A scope is the one symbol built before its position is known.
 * `SymbolRegistry.getOrCreateScope` mints it on first reference, which may be a
 * member collector reaching for its enclosing scope, and only
 * `ScopeCollector` -- running on the `scope` block itself -- can say where the
 * scope was written. So there is a window in which the symbol exists and its
 * position does not.
 *
 * Line 0 is what marks that window. It cannot collide with a real position
 * because ANTLR lines are 1-based, which is what lets `ScopeCollector` keep the
 * FIRST declaring block rather than the last: ADR-016 permits a scope to be
 * reopened, and before #1334 the position was assigned unconditionally, so a
 * scope declared in four files reported only the fourth and a conflict naming
 * two definitions printed one location twice.
 *
 * It is a named constant rather than an inline literal because the writer
 * (`ScopeUtils.createScope`) and the reader (`ScopeCollector`) are in different
 * layers. Spelling the sentinel twice is how the two come to disagree about
 * which value means "unset" -- the shape #1300 records, where two places held
 * one fact and the header believed the wrong one.
 */
const UNSET_SOURCE_SPAN: ISourceSpan = {
  line: 0,
  column: 0,
  endLine: 0,
  endColumn: 0,
};

export default UNSET_SOURCE_SPAN;
