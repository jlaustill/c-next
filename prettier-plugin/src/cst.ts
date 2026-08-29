/**
 * CST helpers for the C-Next Prettier plugin (#1364).
 *
 * The plugin prints ANTLR's parse tree directly rather than converting it to a
 * bespoke AST first. That conversion layer is what rotted in the previous
 * implementation: it was a second, hand-maintained model of a grammar ANTLR
 * already generates typed nodes and a rule index for.
 *
 * Everything here is a read-only view over `ParserRuleContext` / `TerminalNode`.
 */

import { TerminalNode, Token } from "antlr4ng";

import { CNextParser } from "../../src/transpiler/logic/parser/grammar/CNextParser";

import ICommentAnchor from "./types/ICommentAnchor";
import ICommentNode from "./types/ICommentNode";
import TCstNode from "./types/TCstNode";
import TPrintableNode from "./types/TPrintableNode";

class Cst {
  /**
   * True when the node is a token rather than a rule context.
   *
   * Structural rather than `instanceof`: the plugin and the transpiler can end
   * up holding separate `antlr4ng` module instances, and `instanceof` silently
   * returns false across them. Only a token carries `symbol`.
   */
  static isTerminal(node: TPrintableNode): node is TerminalNode {
    return (
      typeof node === "object" &&
      node !== null &&
      "symbol" in node &&
      (node as TerminalNode).symbol !== undefined
    );
  }

  /** True when the value is a comment lifted off the HIDDEN channel. */
  static isComment(node: unknown): node is ICommentNode {
    return (
      typeof node === "object" &&
      node !== null &&
      (node as ICommentNode).type === "Comment"
    );
  }

  /** The generated rule index, or null for a token. */
  static ruleIndexOf(node: TCstNode): number | null {
    return Cst.isTerminal(node) ? null : node.ruleIndex;
  }

  /** The generated rule name, or null for a token. Diagnostics only. */
  static ruleNameOf(node: TCstNode): string | null {
    const index = Cst.ruleIndexOf(node);
    return index === null ? null : (CNextParser.ruleNames[index] ?? null);
  }

  /** The comments anchored to this token during parsing, if any. */
  static commentsOf(node: TPrintableNode): ICommentAnchor | undefined {
    if (!Cst.isTerminal(node)) return undefined;
    return (node as TerminalNode & { comments?: ICommentAnchor }).comments;
  }

  /** True for the synthetic end-of-file token, which contributes no text. */
  static isEndOfFile(node: TPrintableNode): boolean {
    return Cst.isTerminal(node) && node.symbol.type === Token.EOF;
  }

  /** Source text: a token's own text, or a context's joined token text. */
  static textOf(node: TCstNode): string {
    return node.getText() ?? "";
  }

  /** Children of a context, never null. */
  static childrenOf(node: TCstNode): TCstNode[] {
    if (Cst.isTerminal(node)) return [];
    return (node.children ?? []) as TCstNode[];
  }

  /**
   * Indices into `children` of every child matching `ruleIndex`.
   *
   * Indices rather than nodes because Prettier navigates by property path:
   * `path.call(print, "children", index)`.
   */
  static childIndicesByRule(node: TCstNode, ruleIndex: number): number[] {
    const indices: number[] = [];
    const children = Cst.childrenOf(node);
    for (let index = 0; index < children.length; index += 1) {
      if (Cst.ruleIndexOf(children[index]) === ruleIndex) indices.push(index);
    }
    return indices;
  }

  /** Index of the first child matching `ruleIndex`, or null. */
  static firstChildIndexByRule(
    node: TCstNode,
    ruleIndex: number,
  ): number | null {
    return Cst.childIndicesByRule(node, ruleIndex)[0] ?? null;
  }

  /** Indices of every child that is a rule context, skipping punctuation. */
  static ruleChildIndices(node: TCstNode): number[] {
    const indices: number[] = [];
    const children = Cst.childrenOf(node);
    for (let index = 0; index < children.length; index += 1) {
      if (Cst.ruleIndexOf(children[index]) !== null) indices.push(index);
    }
    return indices;
  }

  /** Texts of every direct token child, in order. */
  static terminalTexts(node: TCstNode): string[] {
    return Cst.childrenOf(node)
      .filter((child) => Cst.isTerminal(child))
      .map((child) => Cst.textOf(child));
  }

  /** True when the context has a direct token child with this exact text. */
  static hasTerminal(node: TCstNode, text: string): boolean {
    return Cst.terminalTexts(node).includes(text);
  }

  /** 1-based line of the node's first token, or null when unavailable. */
  static startLineOf(node: TCstNode): number | null {
    if (Cst.isTerminal(node)) return node.symbol.line;
    return node.start?.line ?? null;
  }

  /** 1-based line of the node's last token, or null when unavailable. */
  static endLineOf(node: TCstNode): number | null {
    if (Cst.isTerminal(node)) return node.symbol.line;
    return node.stop?.line ?? null;
  }

  /** Character offset of the first character, for Prettier's locStart. */
  static startOffsetOf(node: TPrintableNode): number {
    if (Cst.isComment(node)) return node.start;
    if (Cst.isTerminal(node)) return node.symbol.start;
    return node.start?.start ?? 0;
  }

  /** Character offset of the last character, for Prettier's locEnd. */
  static endOffsetOf(node: TPrintableNode): number {
    if (Cst.isComment(node)) return node.end;
    if (Cst.isTerminal(node)) return node.symbol.stop;
    return node.stop?.stop ?? 0;
  }

  /** The first token printed for this node, or null when it has none. */
  static leftmostTerminal(node: TCstNode): TerminalNode | null {
    if (Cst.isTerminal(node)) return node;
    for (const child of Cst.childrenOf(node)) {
      const found = Cst.leftmostTerminal(child);
      if (found !== null) return found;
    }
    return null;
  }

  /** True when this node's first token carries leading comments. */
  static hasLeadingComments(node: TCstNode): boolean {
    const first = Cst.leftmostTerminal(node);
    if (first === null) return false;
    const anchor = Cst.commentsOf(first);
    return anchor !== undefined && anchor.before.length > 0;
  }

  /**
   * True when a blank line separated these two nodes in the source.
   *
   * `grammar/CNext.g4` sends whitespace to `-> skip`, so there are no
   * whitespace tokens to inspect. Line numbers survive on the tokens
   * themselves, which is all blank-line preservation needs.
   *
   * A node whose first token carries leading comments reports false: the
   * comment records its own separation from what precedes it, and counting the
   * same blank line in both places produced two blank lines on the first run
   * and three on the next -- a formatter that never converged.
   */
  static hasBlankLineBetween(before: TCstNode, after: TCstNode): boolean {
    if (Cst.hasLeadingComments(after)) return false;
    const end = Cst.endLineOf(before);
    const start = Cst.startLineOf(after);
    if (end === null || start === null) return false;
    return start - end > 1;
  }
}

export default Cst;
