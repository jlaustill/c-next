/**
 * Ordered cursor over a rule's children (#1364).
 *
 * Layout code must print every child exactly once. That is not a style rule:
 * comments are anchored to tokens, so a layout that synthesizes `";"` instead
 * of printing the `;` child silently deletes any comment trailing that token.
 * The first version of this printer did exactly that in eighteen places, and
 * the corpus gate caught it as `comments lost: ["// Add one"]`.
 *
 * Consuming through a cursor makes "nothing was skipped" checkable: a layout
 * function that returns while `remaining() > 0` has dropped something.
 */

import { Doc } from "prettier";

import Cst from "./cst";
import TCstNode from "./types/TCstNode";

/** One child, with both its printed form and the node it came from. */
interface ITakenChild {
  doc: Doc;
  node: TCstNode;
}

class ChildCursor {
  private position = 0;

  private constructor(
    private readonly children: TCstNode[],
    private readonly printAt: (index: number) => Doc,
  ) {}

  /** Build a cursor over `node`'s children. */
  static over(node: TCstNode, printAt: (index: number) => Doc): ChildCursor {
    return new ChildCursor(Cst.childrenOf(node), printAt);
  }

  /** How many children remain unconsumed. */
  remaining(): number {
    return this.children.length - this.position;
  }

  /** True when every child has been consumed. */
  done(): boolean {
    return this.remaining() === 0;
  }

  /** The next child without consuming it. */
  peek(): TCstNode | undefined {
    return this.children[this.position];
  }

  /** Source text of the next child, for decisions only — never for output. */
  peekText(): string {
    const next = this.peek();
    return next === undefined ? "" : Cst.textOf(next);
  }

  /** Rule index of the next child, or null for a token or end of children. */
  peekRule(): number | null {
    const next = this.peek();
    return next === undefined ? null : Cst.ruleIndexOf(next);
  }

  /** Consume and print the next child. */
  take(): Doc {
    return this.takeChild().doc;
  }

  /** Consume the next child, returning its doc and its node. */
  takeChild(): ITakenChild {
    const node = this.children[this.position];
    const doc = this.printAt(this.position);
    this.position += 1;
    return { doc, node };
  }

  /** Consume the next child only when it matches `ruleIndex`. */
  takeIfRule(ruleIndex: number): Doc | null {
    return this.peekRule() === ruleIndex ? this.take() : null;
  }

  /** Consume the next child only when it is a token with this exact text. */
  takeIfText(text: string): Doc | null {
    return this.peekText() === text && this.peekRule() === null
      ? this.take()
      : null;
  }

  /** Consume consecutive children matching `ruleIndex`. */
  takeWhileRule(ruleIndex: number): ITakenChild[] {
    const taken: ITakenChild[] = [];
    while (this.peekRule() === ruleIndex) taken.push(this.takeChild());
    return taken;
  }

  /** Consume consecutive children matching any of `ruleIndexes`. */
  takeWhileAnyRule(ruleIndexes: readonly number[]): ITakenChild[] {
    const taken: ITakenChild[] = [];
    while (this.remaining() > 0) {
      const rule = this.peekRule();
      if (rule === null || !ruleIndexes.includes(rule)) break;
      taken.push(this.takeChild());
    }
    return taken;
  }

  /** Consume every child up to but excluding the last `keep`. */
  takeAllButLast(keep: number): ITakenChild[] {
    const taken: ITakenChild[] = [];
    while (this.remaining() > keep) taken.push(this.takeChild());
    return taken;
  }

  /** Consume everything that is left. */
  takeRest(): ITakenChild[] {
    const taken: ITakenChild[] = [];
    while (this.remaining() > 0) taken.push(this.takeChild());
    return taken;
  }
}

export default ChildCursor;
