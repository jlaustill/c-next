import type TTypeInfo from "../../../transpiler/types/TTypeInfo";
import type TValueBinding from "../../../transpiler/types/TValueBinding";

/**
 * #1668 (C7): what an assignment target writes, bound once where the target
 * is typed -- every classifier rule and handler reads this rather than a
 * registry keyed by a name each of them re-derived.
 */
interface IChainBase {
  /** The chain's root, as its spelling binds at the target */
  readonly root: TValueBinding | null;
  /** The root's declared type; none for a scope */
  readonly rootTypeInfo: TTypeInfo | undefined;
  /** The written variable's declared type: the root, or `Scope.member`'s */
  readonly typeInfo: TTypeInfo | undefined;
}

export default IChainBase;
