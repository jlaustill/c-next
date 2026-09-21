import type TPlannedCaseLabel from "./TPlannedCaseLabel";

/**
 * One `case` of a switch, with every label that falls through to its body.
 */
interface IPlannedSwitchCase {
  /** ADR-025's `||` labels, expanded -- the last one carries the body. */
  readonly labels: readonly TPlannedCaseLabel[];

  /**
   * The body's statements, rendered.
   *
   * A thunk because it renders statements, which register effects, and
   * because the generator decides the indentation depth each line sits at.
   * The empty ones are dropped by the generator, not by the planner: "a
   * statement that renders to nothing contributes no line" is a rendering
   * rule.
   */
  readonly renderBody: () => readonly string[];
}

export default IPlannedSwitchCase;
