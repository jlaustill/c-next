import type IDeclaredSource from "../../3-Declare/types/IDeclaredSource";
import type IProgram from "../../../types/IProgram";

/** 1.4's artifact: the resolved program, and 1.3's files carried on to 2.1 (#1991) */
interface IResolvedProgram {
  readonly program: IProgram;
  readonly sources: readonly IDeclaredSource[];
}

export default IResolvedProgram;
