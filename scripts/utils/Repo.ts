/**
 * The repository this tooling acts on.
 *
 * `scripts/setup-project.ts` declared the owner separately, so changing it was
 * a two-file edit -- the shape `CLAUDE.md` calls the worst anti-pattern in the
 * project. One declaration, both callers. The repository moved to
 * smeltworks/cnx in #2180.
 */
class Repo {
  static readonly OWNER = "smeltworks";

  static readonly NAME = "cnx";

  /** `owner/name`, the form the REST paths and `gh` take. */
  static slug(): string {
    return `${Repo.OWNER}/${Repo.NAME}`;
  }
}

export default Repo;
