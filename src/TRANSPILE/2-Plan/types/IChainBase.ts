import type TTypeInfo from "../../../types/TTypeInfo";
import type TValueBinding from "../../../types/TValueBinding";
import type IChainStep from "../../../types/IChainStep";

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
  /**
   * #1668 (C12): the chain's final step as the one operand typer typed it --
   * what the last op reads, and for a subscript whether it is an element, a
   * slice, a bit or a bit range. Undefined when nothing typed the chain.
   */
  readonly last: IChainStep | undefined;
}

export default IChainBase;
