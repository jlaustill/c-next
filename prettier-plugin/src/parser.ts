/**
 * Parser for the C-Next Prettier plugin (#1364).
 *
 * This file used to be 1,993 lines converting ANTLR contexts into a bespoke AST
 * declared in `nodes.ts`. That conversion was the hand-maintained mapping of the
 * grammar, and it is what silently rotted when #572 moved the parser: it went on
 * referencing eight rules that no longer exist.
 *
 * Now it delegates to `CNextSourceParser`, the transpiler's single parse entry
 * point, hands Prettier the parse tree unchanged, and anchors each comment to
 * the token it belongs to.
 */

import { ParseTree, Token } from "antlr4ng";

import CNextSourceParser from "../../src/transpiler/logic/parser/CNextSourceParser";
import { CNextLexer } from "../../src/transpiler/logic/parser/grammar/CNextLexer";

import Cst from "./cst";
import ICommentAnchor from "./types/ICommentAnchor";
import TCstNode from "./types/TCstNode";
import ICommentNode from "./types/ICommentNode";
import TCstRoot from "./types/TCstRoot";

/** Prettier reports a parse failure through an error carrying `loc`. */
interface IPrettierSyntaxError extends Error {
  loc: { start: { line: number; column: number } };
}

/**
 * Comment token types, from the generated lexer.
 *
 * ADR-043 puts all three on `channel(HIDDEN)`, which is what makes them
 * recoverable here without their appearing in the parse tree.
 */
const COMMENT_TOKEN_TYPES = new Set<number>([
  CNextLexer.DOC_COMMENT,
  CNextLexer.LINE_COMMENT,
  CNextLexer.BLOCK_COMMENT,
]);

/** Build the error Prettier expects, pointing at the first parse failure. */
function syntaxError(
  message: string,
  line: number,
  column: number,
): IPrettierSyntaxError {
  const error = new Error(message) as IPrettierSyntaxError;
  error.loc = { start: { line, column } };
  return error;
}

/** The last line a token occupies; block comments span several. */
function lastLineOf(token: Token): number {
  const text = token.text ?? "";
  let newlines = 0;
  for (const character of text) if (character === "\n") newlines += 1;
  return token.line + newlines;
}

/** Turn a comment token into the node the printer emits verbatim. */
function toCommentNode(
  token: Token,
  previousEndLine: number | null,
): ICommentNode {
  return {
    type: "Comment",
    value: token.text ?? "",
    block: token.type === CNextLexer.BLOCK_COMMENT,
    documentation: token.type === CNextLexer.DOC_COMMENT,
    start: token.start,
    end: token.stop,
    line: token.line,
    endLine: lastLineOf(token),
    // Filled in once the following comment or token is known.
    endsItsLine: true,
    precededByBlankLine:
      previousEndLine !== null && token.line - previousEndLine > 1,
  };
}

/**
 * Anchor every comment to a token, keyed by token index.
 *
 * A comment on the same line as the token before it is that token's trailing
 * comment; anything else leads the next real token. Deciding this once, from
 * the original token stream, is what keeps formatting idempotent.
 */
function anchorComments(tokens: Token[]): Map<number, ICommentAnchor> {
  const anchors = new Map<number, ICommentAnchor>();
  const pendingBefore: ICommentNode[] = [];
  let previousReal: Token | null = null;
  let previousEndLine: number | null = null;

  /** Line of the next token that is not a comment, for `endsItsLine`. */
  const nextRealLine = (from: number): number | null => {
    for (let index = from + 1; index < tokens.length; index += 1) {
      if (!COMMENT_TOKEN_TYPES.has(tokens[index].type)) {
        return tokens[index].line;
      }
    }
    return null;
  };

  const anchorFor = (tokenIndex: number): ICommentAnchor => {
    const existing = anchors.get(tokenIndex);
    if (existing !== undefined) return existing;
    const created: ICommentAnchor = {
      before: [],
      after: [],
      blankLineBeforeToken: false,
      atFileStart: false,
    };
    anchors.set(tokenIndex, created);
    return created;
  };

  for (let position = 0; position < tokens.length; position += 1) {
    const token = tokens[position];
    if (COMMENT_TOKEN_TYPES.has(token.type)) {
      const comment = toCommentNode(token, previousEndLine);
      const following = nextRealLine(position);
      comment.endsItsLine = following === null || following > comment.endLine;
      // A comment trails the token before it exactly when it shares that
      // token's line. Nothing here may consult where the *formatter* will put
      // the line breaks: a predicate that does gives a different answer on the
      // second run, and the comment migrates. The printer holds up the other
      // half of this -- it renders a leading comment on its own line, so
      // re-parsing its own output classifies the comment the same way.
      const trailsPreviousToken =
        previousReal !== null &&
        previousReal.line === token.line &&
        pendingBefore.length === 0;
      if (previousReal !== null && trailsPreviousToken) {
        anchorFor(previousReal.tokenIndex).after.push(comment);
      } else {
        pendingBefore.push(comment);
      }
      previousEndLine = comment.endLine;
      continue;
    }
    if (token.channel !== 0) continue;

    if (pendingBefore.length > 0) {
      const anchor = anchorFor(token.tokenIndex);
      anchor.atFileStart = previousReal === null;
      for (let index = 0; index < pendingBefore.length; index += 1) {
        const next = pendingBefore[index + 1];
        const followingLine = next === undefined ? token.line : next.line;
        pendingBefore[index].endsItsLine =
          followingLine > pendingBefore[index].endLine;
      }
      anchor.before.push(...pendingBefore);
      const last = pendingBefore[pendingBefore.length - 1];
      anchor.blankLineBeforeToken = token.line - last.endLine > 1;
      pendingBefore.length = 0;
    }
    previousReal = token;
    previousEndLine = lastLineOf(token);
  }

  return anchors;
}

/** Hang each token's comments on the tree node that prints it. */
function attachToTerminals(
  node: ParseTree,
  anchors: Map<number, ICommentAnchor>,
): void {
  // `Cst.isTerminal` rather than `instanceof`: the plugin and the transpiler can
  // hold separate `antlr4ng` module instances, and `instanceof` returns false
  // across them -- silently attaching nothing, which loses every comment.
  const candidate = node as unknown as TCstNode;
  if (Cst.isTerminal(candidate)) {
    const anchor = anchors.get(candidate.symbol.tokenIndex);
    if (anchor !== undefined) {
      (candidate as unknown as { comments?: ICommentAnchor }).comments = anchor;
    }
    return;
  }
  const children = (node as { children?: ParseTree[] | null }).children;
  if (!children) return;
  for (const child of children) attachToTerminals(child, anchors);
}

/**
 * Parse C-Next source into the parse tree Prettier will print.
 *
 * Throws on any syntax error: a formatter that cannot parse a file must leave
 * it alone rather than emit a guess.
 */
function parse(source: string): TCstRoot {
  const { tree, tokenStream, errors } = CNextSourceParser.parse(source);

  if (errors.length > 0) {
    const first = errors[0];
    throw syntaxError(first.message, first.line, first.column);
  }

  tokenStream.fill();
  attachToTerminals(tree, anchorComments(tokenStream.getTokens()));
  return tree as TCstRoot;
}

export default parse;
