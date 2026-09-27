/**
 * #1668 / #1664: 1.4 Resolve's half of the lexical frames, and the questions
 * later passes ask of them.
 *
 * 1.3 recorded what each frame declares from one file's tree. Settling needs
 * the whole program: a bare type may name a scope type another file declares
 * (ADR-057), and a const local folds against the program's consts. After
 * this, a frame is frozen and every pass reads the same one.
 *
 * Positions compare as `(line, column)`. Stage 4d and Stage 5 reuse Stage 3's
 * parse, so a node's position is the same in every pass.
 */
import ArrayDimensionParser from "../../utils/ArrayDimensionParser";
import TYPE_WIDTH from "../../transpiler/constants/TYPE_WIDTH";
import DeferredTypes from "./DeferredTypes";
import type ILexicalFrame from "../../transpiler/types/ILexicalFrame";
import type ILocalDeclaration from "../../transpiler/types/ILocalDeclaration";
import type ISourceSpan from "../../transpiler/types/ISourceSpan";

/** A use's position */
type TPosition = Pick<ISourceSpan, "line" | "column">;

class LexicalFrames {
  /**
   * The settled, frozen copy of a file's frames.
   *
   * @param isScopeType the whole program's ADR-057 answer
   * @param constValuesIn the program's const values visible in a scope
   */
  static settle(
    frame: ILexicalFrame,
    isScopeType: (qualifiedName: string) => boolean,
    constValuesIn: (scopePath: string) => ReadonlyMap<string, number>,
  ): ILexicalFrame {
    return LexicalFrames.settleFrame(
      frame,
      isScopeType,
      new Map(constValuesIn(frame.scopePath)),
      constValuesIn,
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

  /** Local consts visible at `at`, over `base` */
  static constValuesAt(
    root: ILexicalFrame,
    at: TPosition,
    base: ReadonlyMap<string, number>,
  ): ReadonlyMap<string, number> {
    const values = new Map(base);
    for (const frame of LexicalFrames.pathTo(root, at)) {
      for (const declaration of frame.declarations) {
        if (
          declaration.constValue !== null &&
          LexicalFrames.before(declaration.span, at)
        ) {
          values.set(declaration.name, declaration.constValue);
        }
      }
    }
    return values;
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
    inherited: ReadonlyMap<string, number>,
    constValuesIn: (scopePath: string) => ReadonlyMap<string, number>,
  ): ILexicalFrame {
    // A scope frame starts from the scope's own consts, not its parent's
    const env =
      frame.kind === "scope"
        ? new Map(constValuesIn(frame.scopePath))
        : new Map(inherited);

    // Declarations and child frames in source order, so a const is visible
    // to what follows it and to nothing before it.
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
            env,
            constValuesIn,
          ),
        );
        continue;
      }
      const settled = LexicalFrames.settleDeclaration(
        item.declaration,
        isScopeType,
        env,
      );
      if (settled.constValue !== null) {
        env.set(settled.name, settled.constValue);
      }
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
    env: Map<string, number>,
  ): ILocalDeclaration {
    const arrayDimensions = declaration.arrayDimensions.map((dimension) =>
      typeof dimension === "string" && dimension !== ""
        ? (ArrayDimensionParser.parseText(dimension, {
            constValues: env,
            typeWidths: TYPE_WIDTH,
          }) ?? dimension)
        : dimension,
    );
    const constValue =
      declaration.isConst &&
      declaration.initialValue !== null &&
      arrayDimensions.length === 0
        ? (ArrayDimensionParser.parseText(declaration.initialValue, {
            constValues: env,
            typeWidths: TYPE_WIDTH,
          }) ?? null)
        : null;
    return Object.freeze({
      ...declaration,
      type: DeferredTypes.settleType(declaration.type, isScopeType),
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
