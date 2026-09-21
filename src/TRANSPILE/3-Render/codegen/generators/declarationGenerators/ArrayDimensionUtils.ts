/**
 * ArrayDimensionUtils - Shared utilities for rendering array dimension strings.
 *
 * Used by StructGenerator's planner and ScopeGenerator for consistent array
 * dimension handling.
 *
 * #1445 box 3: takes planned dimensions and a capacity, not parse contexts.
 * Both callers hold the tree, so either could have read it -- and that is why
 * neither does: two readers is the duplicate derivation CLAUDE.md forbids, so
 * the orchestrator plans it once and both ask for the plan.
 */
import type IPlannedDimension from "../../types/IPlannedDimension";

/**
 * Render an array type's dimensions, e.g. `[4][4]`.
 *
 * Supports every arity the grammar admits, including the unsized `[]`.
 *
 * @param dimensions the type's dimensions, or null when the type has none
 * @returns the dimension string, or `""` when there are none
 */
function renderArrayTypeDimensions(
  dimensions: readonly IPlannedDimension[] | null,
): string {
  if (dimensions === null) {
    return "";
  }

  return dimensions
    .map((dimension) =>
      dimension.renderSize === null ? "[]" : `[${dimension.renderSize()}]`,
    )
    .join("");
}

/**
 * Render a bounded string's capacity dimension, e.g. `[33]` for `string<32>`.
 *
 * The `+1` is the null terminator, and it is decided HERE rather than by the
 * planner: a capacity is a language fact where a dimension is a C one.
 *
 * @param capacity the declared capacity, or null when the type is not a
 *   bounded string
 * @returns the dimension string, or `""` when there is no capacity
 */
function renderStringCapacityDimension(capacity: number | null): string {
  return capacity === null ? "" : `[${capacity + 1}]`;
}

class ArrayDimensionUtils {
  static readonly renderArrayTypeDimensions = renderArrayTypeDimensions;
  static readonly renderStringCapacityDimension = renderStringCapacityDimension;
}

export default ArrayDimensionUtils;
