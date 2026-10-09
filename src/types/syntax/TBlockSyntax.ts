import type TStatement from "./TStatement";

/** `{ ... }`: its statements, in order -- the shape every statement body has */
type TBlockSyntax = Extract<TStatement, { readonly kind: "forever" }>["body"];

export default TBlockSyntax;
