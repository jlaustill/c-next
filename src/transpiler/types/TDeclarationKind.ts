/**
 * What a top-level declaration is, for the ordering decisions 2.2 Plan makes.
 *
 * Deliberately coarse. It exists so `DeclarationOrder` can answer "which
 * declaration is the first that could use a callback typedef" without being
 * handed a parse tree -- the question is about the SHAPE of the file, and a
 * richer type would invite the pass to start asking about contents (#1317).
 */
type TDeclarationKind = "function" | "scope" | "other";

export default TDeclarationKind;
