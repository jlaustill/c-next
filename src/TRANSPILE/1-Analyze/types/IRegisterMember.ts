/**
 * A register member (ADR-004), resolved from a chain as the author wrote it.
 */
interface IRegisterMember {
  /** The member's key in `registerMemberAccess`, e.g. `Board__R__ST`. */
  readonly key: string;
  /** The access modifier declared on the member. */
  readonly access: string;
  /** The member name as written, e.g. `ST`. */
  readonly member: string;
  /** The chain up to the member as written, e.g. `this.R.ST`. */
  readonly spelling: string;
  /** How many chain names the register and member consumed. */
  readonly consumed: number;
}

export default IRegisterMember;
