import type IPreprocessOptions from "./IPreprocessOptions";
import type IPreprocessResult from "./IPreprocessResult";

/**
 * #1713: the compiler run 1.2 reads headers with. The host constructs it for
 * the compiler 1.2 chose for the run's target, so 1.2 runs that compiler
 * without holding the filesystem port itself.
 */
interface IHeaderPreprocessor {
  isAvailable(): boolean;

  /** Where the compiler it runs was found, so two of one name are told apart; null when none is */
  compilerPath(): string | null;

  preprocess(
    filePath: string,
    options?: IPreprocessOptions,
  ): Promise<IPreprocessResult>;

  preprocessString(
    content: string,
    filename: string,
    options?: IPreprocessOptions,
  ): Promise<IPreprocessResult>;
}

export default IHeaderPreprocessor;
