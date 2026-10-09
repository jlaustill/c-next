import type IProgramSyntax from "./syntax/IProgramSyntax";

/**
 * What the run keeps of one file once 2.1 Analyze is done with it (#1932).
 *
 * Plain data only: 2.2 Plan and 2.3 Render read `program`, and the parse tree
 * and token stream 1.2 produced are released before either begins, so nothing
 * after 2.1 can reach them.
 */
interface IAnalyzedFile {
  readonly program: IProgramSyntax;
  readonly declarationCount: number;
}

export default IAnalyzedFile;
