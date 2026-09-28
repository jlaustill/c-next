import type ILocalDeclaration from "./ILocalDeclaration";
import type ISourceSpan from "./ISourceSpan";

/**
 * One lexical region of a file and what it declares, with the regions
 * nested inside it (#1668, #1664).
 *
 * Every function body, braced block, `for` header and scope is a frame, so
 * a name used at a position binds to the declaration visible THERE: sibling
 * blocks are disjoint, and a declaration later in a block does not bind an
 * earlier use. The one flat key per name that 2.1 and 2.2 used before this is
 * what let a shadowing local overwrite the variable it shadowed.
 */
interface ILexicalFrame {
  readonly kind: "file" | "scope" | "function" | "block" | "for";
  /** The construct that opened it */
  readonly span: ISourceSpan;
  /** The enclosing scope's path, "" outside one */
  readonly scopePath: string;
  /** A function frame's function, by C name; null for any other frame */
  readonly functionCName: string | null;
  /** In source order */
  readonly declarations: ReadonlyArray<ILocalDeclaration>;
  /** In source order, non-overlapping */
  readonly children: ReadonlyArray<ILexicalFrame>;
}

export default ILexicalFrame;
