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
import IDeclaredVar from "./types/IDeclaredVar";
import DeclarationScopeCollector from "./DeclarationScopeCollector";
import TChainRoot from "./types/TChainRoot";
import CodeGenState from "../../transpiler/state/CodeGenState";

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
    return this.declarationOfNameLexical(name, frame)?.typeText ?? null;
  }

  /**
   * The whole declaration a name resolves to, searching outward as above.
   *
   * #1322: `typeOfNameLexical` is this with `.typeText` taken off the end, and
   * is kept because its callers ask only that. The outward walk is written once
   * -- two copies would be free to disagree about shadowing, which is the bug
   * this class was extracted to prevent (#1183).
   */
  public declarationOfNameLexical(
    name: string,
    frame: IScopeFrame,
  ): IDeclaredVar | null {
    let current: IScopeFrame | null = frame;
    while (current) {
      const declared = current.vars.get(name);
      if (declared) return declared;
      current = current.parent;
    }
    return null;
  }

  /**
   * The declaration a SPELLING names -- the one question ADR-016's three roots
   * ask, answered once.
   *
   * A bare name searches outward, so an inner declaration shadows an outer one.
   * `global.x` and `this.x` do NOT search: each states where to look, and
   * falling through to the outward walk is what made a shadowing local capture
   * them.
   *
   * #1322 review: this existed four times with four different answers.
   * `BitAccessAnalyzer` and `ConstAssignmentAnalyzer` gave `global.` its own
   * arm and let `this.` fall through; `CompoundAssignmentAnalyzer` and
   * `OperandTypeResolver` dropped both roots. Each divergence was observable,
   * and three of them emitted broken C at exit 0 -- an out-of-bounds write
   * (`global.arr[9]` against a `u8[4]` while a `u8[16]` shadowed it), a write
   * to a const scope member, and a `strncpy` target fed to `cnx_clamp_add_u8`.
   * A fourth turned a correct diagnostic into an `Internal:` assertion at
   * `1:0`, because 2.1 said it had rejected a program it had not.
   *
   * `ChainRoot` answers WHICH spelling this is; this answers what that spelling
   * BINDS TO. Sharing only the first is what CLAUDE.md's "single source of
   * truth means the decision, not just the data" is about -- the four sites
   * already agreed on the root and still disagreed on the declaration.
   */
  public declarationFor(
    root: TChainRoot,
    name: string,
    frame: IScopeFrame,
  ): IDeclaredVar | null {
    if (root === null) return this.declarationOfNameLexical(name, frame);
    if (root === "global") return this.globalFrame.vars.get(name) ?? null;
    return ScopeFrameResolver.scopeFrameOf(frame)?.vars.get(name) ?? null;
  }

  /**
   * `typeOfName` for a spelling that may carry a root.
   *
   * The run-wide fallback applies to a bare name and to `global.`, because
   * either can name a file-scope declaration that arrived through an `#include`
   * (#1220). It does NOT apply to `this.`: the fallback is keyed by BARE name
   * and would answer with an unrelated file-scope declaration. A scope member
   * needs no fallback anyway -- `this.` is only writable inside the scope's own
   * body, which is in the file that declares it.
   */
  public typeOfNameFor(
    root: TChainRoot,
    name: string,
    frame: IScopeFrame,
  ): string | null {
    const declared = this.declarationFor(root, name, frame)?.typeText ?? null;
    if (declared !== null || root === "this") return declared;
    return CodeGenState.getCNextVariableTypeName(name);
  }

  /**
   * The frame that IS the enclosing `scope` -- the one holding its members --
   * or null outside any scope, where `this.` is E0431's to reject.
   *
   * A scope's members live in the frame its declaration pushed; a method or
   * block inside it pushes a child that INHERITS `scopePath`. So the scope's
   * own frame is the outermost frame still carrying this `scopePath`, which is
   * also correct for a scope declared inside another -- the outer scope's frame
   * carries a different path and stops the walk.
   */
  private static scopeFrameOf(frame: IScopeFrame): IScopeFrame | null {
    if (frame.scopePath === "") return null;
    let current: IScopeFrame = frame;
    while (
      current.parent !== null &&
      current.parent.scopePath === frame.scopePath
    ) {
      current = current.parent;
    }
    return current;
  }
}

export default ScopeFrameResolver;
