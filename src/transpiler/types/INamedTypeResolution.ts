/**
 * Which syntactic branch answered for a NAMED type, what was written, and what
 * it resolved to.
 *
 * `branch` is the part a resolved name cannot carry. `written` is the
 * identifier before any scope qualification, which a caller that must defer has
 * to record -- ADR-057 resolves from the parse tree, so the written form is the
 * input, not the output.
 *
 * #1445: lifted out of `TypeBinding` so a pass that must not name a parse type
 * can still receive the ladder's answer. It names none itself, which is what
 * lets 2.3 Render take this instead of the accessors it used to be handed.
 */
interface INamedTypeResolution {
  readonly branch: "this" | "global" | "qualified" | "bare";
  readonly written: string;
  readonly name: string;
}

export default INamedTypeResolution;
