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
import ConstantEvaluator from "../../utils/ConstantEvaluator";
import ConstantFold from "../../utils/ConstantFold";
import DeferredTypes from "./DeferredTypes";
import type IConstantEnvironment from "../../utils/types/IConstantEnvironment";
import type TConstExpr from "../../types/TConstExpr";
import type TConstResult from "../../types/TConstResult";
import type ILexicalFrame from "../../types/ILexicalFrame";
import type ILocalDeclaration from "../../types/ILocalDeclaration";
import type ISourceSpan from "../../types/ISourceSpan";

/** A use's position */
type TPosition = Pick<ISourceSpan, "line" | "column">;

/**
 * What a name in a constant expression is worth where it is written, as the
 * program's binder decides it (#1175: the whole chain, not a bare name).
 * `settled` answers for a local the binder returns: the frames the binder
 * walks are the unsettled ones, and a local's value is known once its own
 * declaration has been settled, which source order guarantees for every
 * local a use can bind.
 */
type TValueOf = (
  name: Extract<TConstExpr, { kind: "name" }>,
  settled: (declaration: ILocalDeclaration) => ILocalDeclaration | undefined,
) => TConstResult;

class LexicalFrames {
  /**
   * The settled, frozen copy of a file's frames.
   *
   * @param isScopeType the whole program's ADR-057 answer
   * @param valueOf a name's value where it is written, from the one binder
   */
  static settle(
    frame: ILexicalFrame,
    isScopeType: (qualifiedName: string) => boolean,
    valueOf: TValueOf,
  ): ILexicalFrame {
    const settledOf = new Map<ILocalDeclaration, ILocalDeclaration>();
    const env: IConstantEnvironment = {
      valueOf: (name) =>
        valueOf(name, (declaration) => settledOf.get(declaration)),
    };
    return LexicalFrames.settleFrame(frame, isScopeType, env, settledOf);
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
      const child = LexicalFrames.childAt(current, at);
      if (!child) {
        return path;
      }
      path.push(child);
      current = child;
    }
  }

  /**
   * The child frame containing `at`, if one does. Children are in source
   * order and never overlap, so the only candidate is the last that starts
   * at or before `at`, found by binary search. #1760 second review: a
   * linear scan here ran for every binding, so a file of N functions took
   * O(N^2) -- 2000 functions compiled in 15s against main's 5s.
   */
  private static childAt(
    frame: ILexicalFrame,
    at: TPosition,
  ): ILexicalFrame | undefined {
    const children = frame.children;
    let low = 0;
    let high = children.length - 1;
    let candidate: ILexicalFrame | undefined;
    while (low <= high) {
      const middle = (low + high) >> 1;
      if (LexicalFrames.compare(children[middle].span, at) <= 0) {
        candidate = children[middle];
        low = middle + 1;
      } else {
        high = middle - 1;
      }
    }
    return candidate !== undefined && LexicalFrames.contains(candidate.span, at)
      ? candidate
      : undefined;
  }

  private static settleFrame(
    frame: ILexicalFrame,
    isScopeType: (qualifiedName: string) => boolean,
    env: IConstantEnvironment,
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
          LexicalFrames.settleFrame(item.child, isScopeType, env, settledOf),
        );
        continue;
      }
      const settled = LexicalFrames.settleDeclaration(
        item.declaration,
        isScopeType,
        env,
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

  /**
   * #1760 review: a declaration's own dimensions come before its name, so
   * they see the enclosing binding (`u8[N] N`). Its initializer comes after
   * the name and sees the new one, as C scopes it and as emission binds it,
   * so a const that names itself has no value; whether it is allowed at all
   * is #1643's. Folding both at the name's start gave `const u16 N <- N + 1`
   * the value 5 while the C read the uninitialized local.
   *
   * #1175: each name in a dimension or an initializer carries its own
   * position, and binds there -- which is that rule, with nothing to pick.
   */
  private static settleDeclaration(
    declaration: ILocalDeclaration,
    isScopeType: (qualifiedName: string) => boolean,
    env: IConstantEnvironment,
  ): ILocalDeclaration {
    const arrayDimensions = declaration.arrayDimensions.map((dimension, i) => {
      const expr = declaration.arrayDimensionExprs[i];
      return expr ? ConstantFold.dimension(expr, env) : dimension;
    });
    const type = DeferredTypes.settleType(declaration.type, isScopeType);
    const constValue =
      declaration.isConst &&
      declaration.initialValueExpr !== null &&
      arrayDimensions.length === 0
        ? (ConstantFold.declaredValue(
            ConstantEvaluator.evaluate(declaration.initialValueExpr, env),
            type,
          ) ?? null)
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

  /** Whether a position lies in a span, whose end is exclusive (ISourceSpan) */
  private static contains(span: ISourceSpan, at: TPosition): boolean {
    return (
      LexicalFrames.compare(span, at) <= 0 &&
      LexicalFrames.compare(at, {
        line: span.endLine,
        column: span.endColumn,
      }) < 0
    );
  }
}

export default LexicalFrames;
