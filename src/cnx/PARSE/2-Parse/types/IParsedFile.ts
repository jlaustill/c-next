import type { CommonTokenStream } from "antlr4ng";

import type * as Parser from "../grammar/CnxParser";
import type ISourceSyntax from "../../../types/ISourceSyntax";

/**
 * What 1.2 Parse produces for one file: syntax, and nothing derived from it.
 *
 * The tree and its token stream stay in 1.2 (#1991): the run takes
 * `ISourceSyntax` from `SourceSyntax.of`, and only tools that read the tree
 * itself (the prettier plugin, `format-fidelity`, `grammar-coverage`) hold
 * this.
 *
 * ## What rides along, and why it is not "derived"
 *
 * `declarationCount`, `comments` and `parseErrors` are all properties OF the
 * parse rather than conclusions drawn from it: each is produced while the
 * lexer and parser run, and none can be recovered later without walking the
 * tree or the token stream again. That is the test a field must pass to live
 * here -- not "is it cheap to compute" but "is 1.2 the only pass that can
 * still see it for free".
 *
 * `comments` is the whole-file answer, and before #1445 it was derived in 2.1
 * -- `CommentExtractor` calling `CommentScanner.extractAll()` to check MISRA
 * C:2012 Rules 3.1 and 3.2, off a token stream the parse had already filled.
 * A pass re-deriving a fact about the PARSE is what the lifetime axis forbids,
 * so it is computed once, here, by the pass that owns it.
 *
 * What did NOT move, and is not the same question: 1.2 holds ONE
 * `CommentScanner` per parse and `ProgramLowering` asks it `getCommentsBefore`
 * to attach each item's leading comments to `program` (#1932). That is a query
 * about a token INDEX, not about the file, and this field cannot answer it.
 * An earlier draft of this comment called that "two more derivations" and
 * counted three in total; it was one instance answering positional queries,
 * and the whole-file scan it was being added to was only ever done once.
 *
 * ## Parse errors are carried, not returned beside it
 *
 * A parse that failed is still a parse, and its errors are 1.2's output. They
 * were previously returned in a second channel, which meant the artifact only
 * existed on the success path and a caller could not be handed "the parse"
 * without also being handed its errors separately. Carrying them is what lets
 * `CNextSourceParser.parse` return this type directly and retires the private
 * `IParseResult` that restated the other three fields (#1445).
 *
 * A non-empty `parseErrors` means the tree is a RECOVERY tree: ANTLR still
 * returns one, and it is not to be trusted for anything but reporting.
 */
interface IParsedFile extends ISourceSyntax {
  readonly tree: Parser.ProgramContext;
  readonly tokenStream: CommonTokenStream;

  /**
   * Computed on FIRST READ and memoized, not on parse: most callers of
   * `parse` -- the prettier plugin, `format-fidelity`, `grammar-coverage`,
   * `FixtureOccupancy` -- take the tree or the errors and never ask. The
   * transpile run reads it once, in `SourceSyntax.of` (#1991).
   */
  readonly comments: ISourceSyntax["comments"];
}

export default IParsedFile;
