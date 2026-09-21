import type { CommonTokenStream } from "antlr4ng";

import type * as Parser from "../../PARSE/2-Parse/grammar/CNextParser";
import type IComment from "./IComment";
import type ITranspileError from "../../lib/types/ITranspileError";

/**
 * What 1.2 Parse produces for one file: syntax, and nothing derived from it.
 *
 * Named rather than passed as a loose triple because it is the boundary between
 * 1.2 and 1.3 -- "one tree per file, per run" is the rule this carries, and a
 * pass that needs the tree takes this instead of re-parsing.
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
 * What did NOT move, and is not the same question: the render layer holds ONE
 * `CommentScanner` (built in `CodeGenerator`, passed into `CommentUtils`) and
 * asks it `getCommentsBefore` / `getCommentsAfter` to re-attach comments to
 * generated declarations. Those are queries about a token INDEX, not about the
 * file, and this field cannot answer them. An earlier draft of this comment
 * called that "two more derivations" and counted three in total; it is one
 * instance answering two positional queries, and the whole-file scan it was
 * being added to was only ever done once.
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
interface IParsedFile {
  readonly tree: Parser.ProgramContext;
  readonly tokenStream: CommonTokenStream;
  readonly declarationCount: number;

  /**
   * Every comment on the hidden channel, in token order (ADR-043).
   *
   * Computed on FIRST READ and memoized, not on parse: 2.1's MISRA 3.1/3.2
   * check is the only reader, and most callers of `parse` -- the prettier
   * plugin, `format-fidelity`, `grammar-coverage`, `FixtureOccupancy`, every
   * `symbolOnly` include, every file that returned early on a parse error --
   * take the tree or the errors and never ask. Reading it is still a property
   * OF the parse, because the token stream it walks is this artifact's own.
   *
   * Each entry carries `tokenIndex`. Nothing reads it today: the positional
   * question ("which comments precede THIS token") is answered by the render
   * layer's `CommentScanner` off the token stream, and an index-ordered array
   * is not obviously the better answer. It is recorded because 1.2 is the
   * pass that can see it for free, not because a consumer was waiting.
   */
  readonly comments: readonly IComment[];

  /**
   * Syntax errors from the lexer and parser, in the order reported.
   *
   * Empty on a clean parse. Positions are the SOURCE's -- no `sourcePath` is
   * set here, because 1.2 parses text and does not know which file it came
   * from; the caller that supplied the text stamps it.
   */
  readonly parseErrors: readonly ITranspileError[];
}

export default IParsedFile;
