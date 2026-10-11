import type ISyntaxNode from "./ISyntaxNode";

/** One `caseLabel` alternative, as written */
type TCaseLabelSyntax = ISyntaxNode &
  (
    | { readonly kind: "qualified"; readonly path: readonly string[] }
    | { readonly kind: "identifier"; readonly name: string }
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
