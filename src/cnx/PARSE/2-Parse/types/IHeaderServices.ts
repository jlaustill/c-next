import type THeaderDeclarationCache from "./THeaderDeclarationCache";
import type IHeaderCompiler from "../preprocessor/types/IHeaderCompiler";
import type IHeaderPreprocessor from "../preprocessor/types/IHeaderPreprocessor";

/** #1713: what 1.2 asks the host for to read a run's headers */
interface IHeaderServices {
  /**
   * The host's run of `compiler`, with the run's preprocessor cache; it is
   * unavailable when that compiler is not installed
   */
  readonly preprocessorFor: (compiler: IHeaderCompiler) => IHeaderPreprocessor;

  /** #1991: each header's cached declarations; null when the run has no cache */
  readonly headerCache: THeaderDeclarationCache | null;
}

export default IHeaderServices;
