import type ISourceSpan from "../ISourceSpan";
import type TChainRoot from "../TChainRoot";
import type ISyntaxNode from "./ISyntaxNode";

/** One `caseLabel` alternative, as written */
type TCaseLabelSyntax = ISyntaxNode &
  (
    | { readonly kind: "qualified"; readonly path: readonly string[] }
    /**
     * A name in any of ADR-016's three spellings: `LIMIT`, `this.LIMIT` or
     * `global.LIMIT` (#1629). `nameSpan` is the name's own token, which a
     * rooted label does not start with.
     */
    | {
        readonly kind: "identifier";
        readonly root: TChainRoot;
        readonly name: string;
        readonly nameSpan: ISourceSpan;
      }
    | {
        readonly kind: "integer" | "hex";
        readonly text: string;
        readonly negative: boolean;
      }
    | { readonly kind: "binary" | "char"; readonly text: string }
    /** Where the parser recovered from an error and no label was written */
    | { readonly kind: "missing" }
  );

export default TCaseLabelSyntax;
