/**
 * #1668 / #1664: 1.4 Resolve's half of the lexical frames, and the questions
 * later passes ask of them.
 *
 * 1.3 recorded what each frame declares from one file's tree. Settling needs
 * the whole program: a bare type may name a scope type another file declares
 * (ADR-057), and a const local folds with whatever its names bind to. After
 * this, a frame is frozen and every pass reads the same one.
 *
 * Positions compare as `(line, column)`. Stage 4d and Stage 5 reuse Stage 3's
 * parse, so a node's position is the same in every pass.
 */
import ConstantFold from "../../utils/ConstantFold";
import DeferredTypes from "./DeferredTypes";
import type IFoldedConstant from "../../transpiler/types/IFoldedConstant";
import type ILexicalFrame from "../../transpiler/types/ILexicalFrame";
import type ILocalDeclaration from "../../transpiler/types/ILocalDeclaration";
import type ISourceSpan from "../../transpiler/types/ISourceSpan";

/** A use's position */
type TPosition = Pick<ISourceSpan, "line" | "column">;

/**
 * A name's compile-time value where it is used, as the program's binder
 * decides it. `settled` answers for a local the binder returns: the frames
 * the binder walks are the unsettled ones, and a local's value is known
 * once its own declaration has been settled, which source order guarantees
 * for every local a use can bind.
 */
type TConstantAt = (
  name: string,
  at: TPosition,
  settled: (declaration: ILocalDeclaration) => ILocalDeclaration | undefined,
) => IFoldedConstant | undefined;

class LexicalFrames {
  /**
   * The settled, frozen copy of a file's frames.
   *
   * @param isScopeType the whole program's ADR-057 answer
   * @param constantAt a name's value where it is used, from the one binder
   */
  static settle(
    frame: ILexicalFrame,
    isScopeType: (qualifiedName: string) => boolean,
    constantAt: TConstantAt,
  ): ILexicalFrame {
    const settledOf = new Map<ILocalDeclaration, ILocalDeclaration>();
    return LexicalFrames.settleFrame(
      frame,
      isScopeType,
      (name, at) =>
        constantAt(name, at, (declaration) => settledOf.get(declaration)),
      settledOf,
    );
  }

  /** The innermost frame containing `at`; the file frame if none does */
  static frameAt(root: ILexicalFrame, at: TPosition): ILexicalFrame {
    return LexicalFrames.pathTo(root, at).at(-1) ?? root;
  }

  /**
   * The declaration `name` binds to at `at`: in each frame from the innermost
   * outward, the last declaration of `name` that starts before `at`. A later
   * declaration in the same block does not bind an earlier use (#1702), and a
   * sibling block's declaration is never visible (#1666).
   */
  static declarationAt(
    root: ILexicalFrame,
    name: string,
    at: TPosition,
  ): ILocalDeclaration | null {
    const path = LexicalFrames.pathTo(root, at);
    for (let i = path.length - 1; i >= 0; i--) {
      // The LAST matching declaration: a redeclaration in the same frame wins
      const declarations = path[i].declarations;
      let found: ILocalDeclaration | undefined;
      for (const declaration of declarations) {
        if (
          declaration.name === name &&
          LexicalFrames.before(declaration.span, at)
        ) {
          found = declaration;
        }
      }
      if (found) {
        return found;
      }
    }
    return null;
  }

  /** The frames containing `at`, outermost first */
  private static pathTo(root: ILexicalFrame, at: TPosition): ILexicalFrame[] {
    const path = [root];
    let current = root;
    for (;;) {
      const child = current.children.find((candidate) =>
        LexicalFrames.contains(candidate.span, at),
      );
      if (!child) {
        return path;
      }
      path.push(child);
      current = child;
    }
  }

  private static settleFrame(
    frame: ILexicalFrame,
    isScopeType: (qualifiedName: string) => boolean,
    constantAt: (name: string, at: TPosition) => IFoldedConstant | undefined,
    settledOf: Map<ILocalDeclaration, ILocalDeclaration>,
  ): ILexicalFrame {
    // Declarations and child frames in source order, so each local is
    // settled before any use that can bind it.
    const declarations: ILocalDeclaration[] = [];
    const children: ILexicalFrame[] = [];
    const items = [
      ...frame.declarations.map((d) => ({ span: d.span, declaration: d })),
      ...frame.children.map((f) => ({ span: f.span, child: f })),
    ].sort((a, b) => LexicalFrames.compare(a.span, b.span));

    for (const item of items) {
      if ("child" in item) {
        children.push(
          LexicalFrames.settleFrame(
            item.child,
            isScopeType,
            constantAt,
            settledOf,
          ),
        );
        continue;
      }
      const settled = LexicalFrames.settleDeclaration(
        item.declaration,
        isScopeType,
        (name) => constantAt(name, item.declaration.span),
      );
      settledOf.set(item.declaration, settled);
      declarations.push(settled);
    }

    return Object.freeze({
      ...frame,
      declarations: Object.freeze(declarations),
      children: Object.freeze(children),
    });
  }

  private static settleDeclaration(
    declaration: ILocalDeclaration,
    isScopeType: (qualifiedName: string) => boolean,
    constantOf: (name: string) => IFoldedConstant | undefined,
  ): ILocalDeclaration {
    const arrayDimensions = declaration.arrayDimensions.map((dimension) =>
      typeof dimension === "string" && dimension !== ""
        ? (ConstantFold.value(dimension, constantOf) ?? dimension)
        : dimension,
    );
    const type = DeferredTypes.settleType(declaration.type, isScopeType);
    const constValue =
      declaration.isConst &&
      declaration.initialValue !== null &&
      arrayDimensions.length === 0
        ? (ConstantFold.declared(declaration.initialValue, type, constantOf) ??
          null)
        : null;
    return Object.freeze({
      ...declaration,
      type,
      arrayDimensions: Object.freeze(arrayDimensions),
      constValue,
    });
  }

  private static compare(a: TPosition, b: TPosition): number {
    return a.line === b.line ? a.column - b.column : a.line - b.line;
  }

  /** Whether a span starts strictly before a position */
  private static before(span: ISourceSpan, at: TPosition): boolean {
    return LexicalFrames.compare(span, at) < 0;
  }

  private static contains(span: ISourceSpan, at: TPosition): boolean {
    return (
      LexicalFrames.compare(span, at) <= 0 &&
      LexicalFrames.compare(at, {
        line: span.endLine,
        column: span.endColumn,
      }) <= 0
    );
  }
}

export default LexicalFrames;
