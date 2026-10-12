import type IProgram from "../types/IProgram";
import ScopeUtils from "./ScopeUtils";

/**
 * #1643 review: whether `name` is a member of the scope at `scopePath` that
 * binds no value -- a type. A variable or function member is the binder's
 * alone (`bindValue`, by position): `members` has no position, so it would
 * admit a variable whose declaration has not closed. The one place analysis
 * and emission both decide it, so they cannot read a name differently.
 */
class ScopeTypeMember {
  static is(
    members: ReadonlySet<string> | undefined,
    scopePath: string,
    name: string,
    program: Pick<IProgram, "symbolByCName">,
  ): boolean {
    if (!(members?.has(name) ?? false)) {
      return false;
    }
    const kind = program.symbolByCName(
      ScopeUtils.getTranspiledCName({ name, scopePath }),
    )?.kind;
    return kind !== "variable" && kind !== "function";
  }
}

export default ScopeTypeMember;
