/**
 * ADR-004: a register member's access modifier.
 *
 * #1450: this union was spelled out in two places — `IRegisterMemberSymbol.access`
 * and a local `TAccessMode` in `RegisterCollector` — so adding a sixth modifier
 * meant editing both, and a collector that accepted one the symbol could not
 * hold would have type-checked at neither site until the value flowed between
 * them.
 *
 * The MEANING of these values is `utils/RegisterAccessMode`, which answers
 * whether a write composes its value instead of reading it back. The two are
 * deliberately apart: 1.3 Declare may not import a render-side helper, and a
 * type every layer holds cannot carry a predicate only two of them need.
 */
type TRegisterAccessMode = "rw" | "ro" | "wo" | "w1c" | "w1s";

export default TRegisterAccessMode;
