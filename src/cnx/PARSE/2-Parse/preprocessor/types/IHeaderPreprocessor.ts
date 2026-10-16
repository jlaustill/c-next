import type IPreprocessOptions from "./IPreprocessOptions";
import type IPreprocessResult from "./IPreprocessResult";

/**
 * #1713: the compiler run 1.2 reads headers with. The host constructs it for
 * the compiler 1.2 chose for the run's target, so 1.2 runs that compiler
 * without holding the filesystem port itself.
 */
interface IHeaderPreprocessor {
  isAvailable(): boolean;

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
