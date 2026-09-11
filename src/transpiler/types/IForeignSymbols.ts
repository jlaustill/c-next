import type TCSymbol from "./symbols/c/TCSymbol";
import type TCppSymbol from "./symbols/cpp/TCppSymbol";

/**
 * The symbols this program's C and C++ headers declare.
 *
 * A shared contract rather than a codegen type: 1.4 Resolve takes it to derive
 * the cross-file facts that are ABOUT foreign declarations — symbol conflicts
 * among them, which header declares a type, opaque-vs-defined — and the
 * orchestrator supplies it. `Program` holds C-Next symbols only, which is why
 * those three facts could not previously be authored there (#1511).
 *
 * The two languages stay separate because their order is observable: a
 * conflict report lists definitions C-Next first, then C, then C++.
 */
interface IForeignSymbols {
  readonly c: ReadonlyArray<TCSymbol>;
  readonly cpp: ReadonlyArray<TCppSymbol>;

  /**
   * Typedefs a header declared against a forward-declared struct.
   *
   * The RAW set, not the answer: a typedef is only truly opaque if the tag it
   * names never got a body, and resolving that is `Program`'s job. Handing over
   * a pre-resolved set would leave the derivation outside the artifact, which
   * is the thing #1511 is moving.
   */
  readonly opaqueTypedefs: ReadonlySet<string>;

  /** Typedef name to the struct tag it aliases. */
  readonly typedefToTag: ReadonlyMap<string, string>;

  /** Struct tags a header gave a full definition. */
  readonly structTagsWithBodies: ReadonlySet<string>;
}

export default IForeignSymbols;
