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
import CodeGenState from "../../state/CodeGenState";

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
   * inner declaration shadows an outer one, then falling back to the symbol
   * table for a declaration that arrived through an #include. Null when the
   * name is declared nowhere reachable -- a struct field or a call result.
   *
   * Issue #1220: the fallback is the whole cross-file story for the
   * essential-type analyzers. Frames are built by walking THIS file's parse
   * tree, so before it every imported declaration resolved to null, every
   * check that depended on the operand's type quietly concluded "nothing to
   * report", and E0804/E0805/E0807/E0810 all stopped firing the moment their
   * operand crossed a file boundary.
   *
   * Lexical frames are searched FIRST and still win: a local declaration
   * shadows an imported one of the same name, exactly as it did before.
   */
  public typeOfName(name: string, frame: IScopeFrame): string | null {
    return (
      this.typeOfNameLexical(name, frame) ??
      CodeGenState.getCNextVariableTypeName(name)
    );
  }

  /**
   * The lexical half of `typeOfName`: this file's frames only, with no
   * run-wide fallback. Null when the name is declared in no enclosing frame.
   *
   * Issue #1398: the fallback answers "declared ANYWHERE in this run", which is
   * right for the essential-type analyzers (#1220) and wrong for a visibility
   * decision -- a sibling that was never included still resolves through it. The
   * walk is exposed rather than copied so both questions read the same frames:
   * a caller that needs "is this name visible HERE" takes this half and pairs it
   * with a per-file set, instead of re-implementing the outward search and
   * drifting from it. `typeOfName` itself is unchanged for its other callers.
   */
  public typeOfNameLexical(name: string, frame: IScopeFrame): string | null {
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
