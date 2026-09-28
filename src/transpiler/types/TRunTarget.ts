import type ITranspileError from "../../lib/types/ITranspileError";
import type ITargetDescription from "./ITargetDescription";

/**
 * ADR-049: the one target of a run, as 1.4 Resolve settled it.
 *
 * `rejected` carries the diagnostics that stopped it. An error with no
 * `sourcePath` is about the run's options rather than a line of source; the
 * orchestrator places it on the entry file.
 */
type TRunTarget =
  | {
      readonly kind: "resolved";
      readonly name: string;
      /** Where the target came from, highest rung first */
      readonly source: "pragma" | "option" | "platformio";
      readonly description: ITargetDescription;
    }
  | {
      readonly kind: "rejected";
      readonly errors: readonly ITranspileError[];
      /**
       * No rung named a target at all (E0515), as against a name that is
       * unknown or contested. A parse-only run excuses this and only this
       * (#1760 second review).
       */
      readonly absent: boolean;
    };

export default TRunTarget;
