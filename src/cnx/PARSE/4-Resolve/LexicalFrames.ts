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
import DefinitionPoint from "../../utils/DefinitionPoint";
import DeferredTypes from "./DeferredTypes";
import type IConstantEnvironment from "../../utils/types/IConstantEnvironment";
import type TConstExpr from "../../types/TConstExpr";
import type TConstResult from "../../types/TConstResult";
import type ILexicalFrame from "../../types/ILexicalFrame";
import type ILocalDeclaration from "../../types/ILocalDeclaration";
import type ISourceSpan from "../../types/ISourceSpan";
import QualifiedCName from "../../utils/QualifiedCName";

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

/** What settling a frame reads, the same for every frame of a file */
interface ISettleFacts {
  readonly isScopeType: (qualifiedName: string) => boolean;
  readonly isFileScopeName: (cName: string) => boolean;
  readonly env: IConstantEnvironment;
  readonly settledOf: Map<ILocalDeclaration, ILocalDeclaration>;
}

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
    /** A type name as C spells it where it is written (ADR-057) */
    cTypeName: IConstantEnvironment["cTypeName"],
    /** Whether a type name denotes a type where it is written */
    isTypeName: IConstantEnvironment["isTypeName"],
    /** Whether a C identifier is a file-scope symbol's, in any file or header */
    isFileScopeName: (cName: string) => boolean,
    /**
     * Filled with each declaration's settled copy, for a caller that must read
     * the same answer -- a function's parameters, which the header writes
     * (#1863 review: settled twice, `b[4]` in the .c was `b[0]` in the .h)
     */
    settledOf: Map<ILocalDeclaration, ILocalDeclaration> = new Map(),
  ): ILexicalFrame {
    const env: IConstantEnvironment = {
      valueOf: (name) =>
        valueOf(name, (declaration) => settledOf.get(declaration)),
      cTypeName,
      isTypeName,
    };
    return LexicalFrames.settleFrame(
      frame,
      null,
      { isScopeType, isFileScopeName, env, settledOf },
      () => undefined,
    );
  }

  /** The innermost frame containing `at`; the file frame if none does */
  static frameAt(root: ILexicalFrame, at: TPosition): ILexicalFrame {
    return LexicalFrames.pathTo(root, at).at(-1) ?? root;
  }

  /**
   * The declaration `name` binds to at `at`: in each frame from the innermost
   * outward, the last declaration of `name` that has closed by `at`. A later
   * declaration in the same block does not bind an earlier use (#1702), nor
   * does a declaration bind a use in its own initializer (#1643), and a
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
          DefinitionPoint.isDefinedAt(declaration.extent, at)
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

  /**
   * #2019: whether a frame containing `at` declares `name` in a declaration
   * that has not closed by `at` -- the declarations `declarationAt` skips.
   */
  static isUnclosedAt(
    root: ILexicalFrame,
    name: string,
    at: TPosition,
  ): boolean {
    return LexicalFrames.pathTo(root, at).some((frame) =>
      frame.declarations.some(
        (declaration) =>
          declaration.name === name &&
          !DefinitionPoint.isDefinedAt(declaration.extent, at),
      ),
    );
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
    enclosingFunction: string | null,
    facts: ISettleFacts,
    /** The settled local a name binds to where this frame opens */
    enclosing: (name: string) => ILocalDeclaration | undefined,
  ): ILexicalFrame {
    const functionCName = frame.functionCName ?? enclosingFunction;
    const declared = new Map<string, ILocalDeclaration>();
    const visible = (name: string): ILocalDeclaration | undefined =>
      declared.get(name) ?? enclosing(name);
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
          LexicalFrames.settleFrame(item.child, functionCName, facts, visible),
        );
        continue;
      }
      const settled = LexicalFrames.settleDeclaration(
        item.declaration,
        functionCName,
        facts,
        visible(item.declaration.name),
      );
      facts.settledOf.set(item.declaration, settled);
      declared.set(settled.name, settled);
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
   * they see the enclosing binding (`u8[N] N`). #1643: its initializer comes
   * before the declaration closes, so it does not see the new one either --
   * `const u16 N <- N + 1` names the enclosing `N`, or nothing (E0427).
   *
   * #1175: each name in a dimension or an initializer carries its own
   * position, and binds there -- which is that rule, with nothing to pick.
   */
  private static settleDeclaration(
    declaration: ILocalDeclaration,
    functionCName: string | null,
    { isScopeType, env, isFileScopeName }: ISettleFacts,
    /** The settled local this one shadows, if any */
    shadowed: ILocalDeclaration | undefined,
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
        ? ConstantFold.constValue(declaration.initialValueExpr, env, type)
        : null;
    return Object.freeze({
      ...declaration,
      type,
      arrayDimensions: Object.freeze(arrayDimensions),
      constValue,
      emittedName: LexicalFrames.emittedName(
        declaration,
        functionCName,
        isFileScopeName,
        declaration.initializerNames.has(declaration.name)
          ? (shadowed?.emittedName ?? null)
          : null,
      ),
    });
  }

  /**
   * ADR-057: a local that shadows a file-scope name moves to
   * `<function>__<name>`. C has no `::`, so emitted as plain `name` it would
   * make the outer one unreachable and `global.name` would bind the local.
   * A parameter is no exception (#1290): its moved name is the one the `.c`
   * signature, the `.h` prototype and every use in the body read.
   * `__` cannot be written in a C-Next identifier (E0201), so the moved name
   * collides with nothing the source declares.
   *
   * #1643: an initializer that names the enclosing local it shadows reads that
   * one, but C scopes the new name from its declarator, before the
   * initializer. So the new one moves off the enclosing one's C name too --
   * `<function>__<name>`, then `<function>__<name>__2`, and so on.
   */
  private static emittedName(
    declaration: ILocalDeclaration,
    functionCName: string | null,
    isFileScopeName: (cName: string) => boolean,
    /** The C name of the enclosing local its initializer reads, if any */
    readsEmitted: string | null,
  ): string {
    const { name } = declaration;
    if (functionCName === null) {
      return name;
    }
    let emitted = isFileScopeName(name)
      ? QualifiedCName.fromParts([functionCName, name])
      : name;
    let suffix = 1;
    while (emitted === readsEmitted) {
      emitted = QualifiedCName.fromParts([
        functionCName,
        name,
        suffix === 1 ? null : String(suffix),
      ]);
      suffix++;
    }
    return emitted;
  }

  private static compare(a: TPosition, b: TPosition): number {
    return a.line === b.line ? a.column - b.column : a.line - b.line;
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
