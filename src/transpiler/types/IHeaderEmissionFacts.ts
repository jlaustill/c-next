import IHeaderSymbol from "../output/headers/types/IHeaderSymbol";
import IHeaderOptions from "../output/codegen/types/IHeaderOptions";
import IHeaderTypeInput from "../output/headers/generators/IHeaderTypeInput";
import TPassByValueParams from "./TPassByValueParams";

/**
 * The fully-resolved input to one file's header render call
 * (`HeaderGenerator.generate()`), captured at the warm per-file moment
 * (Stage 5) so the render itself can run afterward, once every file has been
 * transpiled, without reading `CodeGenState` at all.
 *
 * #1323: `generateHeaderForFile` used to both DECIDE this content and RENDER
 * it inline, in the same per-file moment. This is the decision, frozen; the
 * render that consumes it (`HeaderEmissionPlanner`) never touches
 * `CodeGenState`, which is what makes issue #1139's failure mode structurally
 * impossible rather than merely fixed -- there is no live per-file state left
 * for a later call to read stale, because nothing here is read live.
 *
 * Every field is resolved from state that is either run-wide (`symbolTable`,
 * `outputExtensions`) or this file's own already-written entry in a
 * path-keyed accumulator (`TranspilerState`) -- never from a `CodeGenState`
 * field that `reset()` clears before the next file. `needsIsr`,
 * `generatedStructInits`, callback typedef resolution and ADR-006 auto-const
 * are exactly those `CodeGenState` fields, which is why they are captured
 * here as already-resolved values (`options`, `typeInput.callbackTypes`)
 * rather than left for a later reader to re-derive from state that no longer
 * describes this file.
 */
interface IHeaderEmissionFacts {
  readonly symbols: readonly IHeaderSymbol[];
  readonly filename: string;
  readonly options: IHeaderOptions;
  readonly typeInput: IHeaderTypeInput | undefined;
  readonly passByValueParams: TPassByValueParams;
  readonly allKnownEnums: ReadonlySet<string>;
  readonly basename: string;
}

export default IHeaderEmissionFacts;
