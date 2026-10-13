/**
 * One file 2.3 Render produced, at the path 1.1 Discover named for it. 3.1
 * Write takes a list of these and nothing else (#1991).
 */
interface IRenderedOutput {
  readonly path: string;
  readonly content: string;
}

export default IRenderedOutput;
