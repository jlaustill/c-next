/**
 * #1713: one value for each output mode. 1.1 names both, and 1.2 takes the
 * one for the mode it settles from the headers it reads.
 */
interface IByOutputMode<T> {
  readonly c: T;
  readonly cpp: T;
}

export default IByOutputMode;
