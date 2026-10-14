import type IArgumentPassing from "./IArgumentPassing";
import type TArgumentForm from "./TArgumentForm";
import type TCArgumentForm from "./TCArgumentForm";

/** How 2.3 writes a call's argument, decided once by 2.2 (#1991) */
interface IPlannedArgument {
  /** The parameter it binds to and how it is passed */
  readonly passing: IArgumentPassing;

  /** How a by-reference argument is written; null unless passed by reference */
  readonly form: TArgumentForm | null;

  /** How an argument to a C or C++ function is written; null for any other */
  readonly cForm: TCArgumentForm | null;

  /** The cast of a C++ enum class value to its integer parameter (#304) */
  readonly enumCast: string | null;
}

export default IPlannedArgument;
