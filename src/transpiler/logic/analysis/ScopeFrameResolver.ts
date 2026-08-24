/**
 * Scope Frame Resolver
 *
 * Answers "what type does this name have HERE?" for the essential-type
 * analyzers, over the frames built by DeclarationScopeCollector.
 *
 * Composed by each analyzer's listener rather than inherited, so the decision
 * -- which frame encloses a node, and which declaration a name resolves to --
 * lives in one place. MISRA Rule 10.1 (BooleanOperandAnalyzer) and Rule 10.4
 * (MixedTypeCategoryAnalyzer) then differ only in how they classify the type
 * text they get back, which is the part that genuinely differs between them.
 *
 * Extracted in Issue #1183: the two listeners had otherwise begun to carry
 * identical frame-walking copies.
 */

import { ParserRuleContext } from "antlr4ng";
import IScopeFrame from "./types/IScopeFrame";
import DeclarationScopeCollector from "./DeclarationScopeCollector";

class ScopeFrameResolver {
  private readonly globalFrame: IScopeFrame;

  // eslint-disable-next-line @typescript-eslint/lines-between-class-members
  private readonly frameOf: Map<ParserRuleContext, IScopeFrame>;

  constructor(collector: DeclarationScopeCollector) {
    this.globalFrame = collector.getGlobalFrame();
    this.frameOf = collector.getFrameOf();
  }

  /**
   * Innermost scope frame enclosing a node, found by walking up its parent
   * chain. Falls back to the global frame for a node outside any function or
   * named scope.
   */
  public frameFor(ctx: ParserRuleContext): IScopeFrame {
    let node: ParserRuleContext | null = ctx;
    while (node) {
      const frame = this.frameOf.get(node);
      if (frame) return frame;
      node = node.parent;
    }
    return this.globalFrame;
  }

  /**
   * Declared type text of a name as seen from a frame, searching outward so an
   * inner declaration shadows an outer one. Null when the name is not declared
   * on that path -- an external symbol, a struct field, or a call result.
   */
  public typeOfName(name: string, frame: IScopeFrame): string | null {
    let current: IScopeFrame | null = frame;
    while (current) {
      const typeName = current.vars.get(name);
      if (typeName) return typeName;
      current = current.parent;
    }
    return null;
  }
}

export default ScopeFrameResolver;
