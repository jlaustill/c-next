import type IComment from "./IComment";
import type ITargetDirective from "./ITargetDirective";
import type ITranspileError from "./ITranspileError";
import type IProgramSyntax from "./syntax/IProgramSyntax";

/**
 * What 1.2 Parse hands 1.3 for one cnx file: plain data, no tree (#1991).
 *
 * "The tree never leaves 1.2": everything a later pass reads is here, read
 * off the tree while 1.2 still holds it. `IParsedFile` is this plus the tree
 * and its token stream, for the tools that format or measure the tree itself.
 */
interface ISourceSyntax {
  readonly declarationCount: number;

  /**
   * Every comment on the hidden channel, in token order (ADR-043), for 2.1's
   * MISRA C:2012 Rules 3.1/3.2 check.
   *
   * Each entry carries `tokenIndex`. Nothing reads it today: the positional
   * question ("which comments precede THIS token") is answered in 1.2 by
   * `ProgramLowering`, which asks the parse's `CommentScanner` while it lowers
   * each item into `program`. It is recorded because 1.2 is the pass that can
   * see it for free, not because a consumer was waiting.
   */
  readonly comments: readonly IComment[];

  /**
   * The file as plain data (#1932): what every pass after 1.2 reads. Meaningful
   * only when `parseErrors` is empty -- a repaired tree's invented names
   * (`<missing IDENTIFIER>`) pass through as names, and the run stops at the
   * parse error before anything reads this.
   */
  readonly program: IProgramSyntax;

  /**
   * The file's `#pragma` lines as plain data (ADR-049), for 1.4 to settle the
   * program's one target.
   */
  readonly targetDirectives: readonly ITargetDirective[];

  /**
   * Syntax errors from the lexer and parser, in the order reported.
   *
   * Empty on a clean parse. Positions are the SOURCE's -- no `sourcePath` is
   * set here, because 1.2 parses text and does not know which file it came
   * from; the caller that supplied the text stamps it.
   */
  readonly parseErrors: readonly ITranspileError[];

  /**
   * 1.2's errors on a tree that DID parse: how a literal or a declared name is
   * written, and the form of a string or array declaration: each code whose
   * Source in `docs/error-codes.md` names `PARSE/2-Parse/` (for E0866, only its
   * form case; its count and struct-literal cases are 2.1's). Kept apart from
   * `parseErrors` because the
   * tree is sound -- the prettier plugin and `format-fidelity` format such a
   * file, and only the transpile run stops on them (#1991). Empty whenever
   * `parseErrors` is not.
   */
  readonly formErrors: readonly ITranspileError[];
}

export default ISourceSyntax;
