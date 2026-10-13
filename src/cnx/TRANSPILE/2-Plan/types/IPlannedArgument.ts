import type IArgumentPassing from "./IArgumentPassing";
import type TArgumentForm from "./TArgumentForm";

/** How 2.3 writes a call's argument, decided once by 2.2 (#1991) */
interface IPlannedArgument {
  /** The parameter it binds to and how it is passed */
  readonly passing: IArgumentPassing;

  /** How a by-reference argument is written; null unless passed by reference */
  readonly form: TArgumentForm | null;

  /** The cast of a C++ enum class value to its integer parameter (#304) */
  readonly enumCast: string | null;
}

export default IPlannedArgument;
