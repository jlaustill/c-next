import type TRunFacts from "../../2-Parse/types/TRunFacts";
import type IDeclaredSource from "../../3-Declare/types/IDeclaredSource";
import type IProgram from "../../../types/IProgram";

/** 1.4's artifact: the resolved program, and 1.3's files and 1.1's facts carried on (#1991) */
interface IResolvedProgram {
  readonly program: IProgram;
  readonly sources: readonly IDeclaredSource[];
  readonly discovery: TRunFacts;
}

export default IResolvedProgram;
