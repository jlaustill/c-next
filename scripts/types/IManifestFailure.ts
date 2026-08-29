/**
 * A way the committed diagnostic manifest shrank.
 *
 * `assertion-removed`: the fixture no longer carries an `.expected.error` at all.
 * `code-removed`: the fixture still errors, but stopped asserting a code it used
 * to -- the quieter regression, because the suite stays green through it.
 */
interface IManifestFailure {
  readonly fixture: string;
  readonly reason: "assertion-removed" | "code-removed";
  readonly detail: string;
}

export default IManifestFailure;
