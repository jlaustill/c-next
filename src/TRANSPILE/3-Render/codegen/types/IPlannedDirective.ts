/**
 * An ADR-037 preprocessor directive, reduced to which shape the parser matched
 * and the directive's own text.
 *
 * #1445: `text` is the concatenated TOKEN text, handed over verbatim --
 * rebuilding it from source positions would change the emitted line, so the
 * caller passes the value rather than the means to recompute it. Trimming is
 * the renderer's, because trimming is string work and that is where a unit
 * test can reach it.
 *
 * Declared here rather than beside the renderer because two modules name it:
 * the renderer that consumes it and the generator that builds it. CLAUDE.md
 * puts a shared shape in a `types/` directory, one per file -- and a union
 * spelled out twice is the duplication that rule exists to stop, which is what
 * the nested ternary S3358 flagged was hiding.
 */
interface IPlannedDirective {
  readonly kind:
    | "define-flag"
    | "define-function"
    | "define-value"
    | "define-other"
    | "conditional"
    | "none";
  readonly text: string;
}

export default IPlannedDirective;
