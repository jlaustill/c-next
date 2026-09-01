/**
 * SPIKE #1431 — THROWAWAY. Deleted before this branch merges.
 *
 * One row of the `scope` table.
 *
 * `parentId` is a **self-referencing foreign key**, not an object reference. That
 * is the whole difference #1298 is about: `ScopeUtils.getScopePath()` walks a live
 * `.parent` chain and needs an identity-based cycle guard, which cannot fire when
 * successive reads return non-identical objects representing the same scope. Under
 * a key, a cycle is a constraint violation on insert rather than a hang at read
 * time, and the guard has nothing left to guard.
 *
 * A scope is "an entry in a table that symbols point at, not a live object graph
 * they hang off" (`docs/architecture/README.md:143`). This row is that sentence.
 */
interface IScopeRow {
  /**
   * PRIMARY KEY. The transpiled scope path (`Outer__Inner`), empty string for the
   * global scope. Chosen over a synthetic id so it joins directly against the
   * transpiled-C-name key space without a translation step.
   */
  readonly id: string;

  /** The leaf, as written. This is the key space `knownScopes` and `scopeMembers` use. */
  readonly name: string;

  /** FOREIGN KEY -> scope.id. `null` only for the global scope, which has no parent. */
  readonly parentId: string | null;

  /** FOREIGN KEY -> file.path: where the scope was declared. A scope may be reopened elsewhere. */
  readonly sourceFile: string;
}

export default IScopeRow;
