/** One match of a pattern in a non-test module under `src/`. */
interface ISourceHit {
  /** Path from the repository root, e.g. `src/TRANSPILE/CodeGenWalker.ts`. */
  readonly file: string;
  readonly offset: number;
  readonly text: string;
}

export default ISourceHit;
