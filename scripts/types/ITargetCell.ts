import type TTargetCellOutcome from "./TTargetCellOutcome";
import type TTestMode from "./TTestMode";

/**
 * One target a fixture ran under, in one mode (#1668 box 15). A fixture's
 * cells are what its report line names as executed and compiled.
 */
interface ITargetCell {
  /** The catalog name the cell ran for, as the transpiler reported it */
  readonly target: string;
  readonly mode: TTestMode;
  readonly outcome: TTargetCellOutcome;
  /** Why it failed, or is an expected failure */
  readonly detail?: string;
  /**
   * An expected-failure host cell whose program still linked and ran: the
   * marker waives the `-Werror` compile, not the execution (#1760 second
   * review)
   */
  readonly executed?: boolean;
}

export default ITargetCell;
