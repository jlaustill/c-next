/**
 * One fixture's committed claim that it asserts a diagnostic.
 *
 * `codes` is empty for a fixture whose `.expected.error` carries no `error[...]`
 * tag -- 116 of 287 today, all of them the uncoded `output/` throws that #1313
 * relocates into pass 2.1. Recording the empty set rather than omitting the
 * fixture is what lets the gate see a coded diagnostic regress to an uncoded one.
 */
interface IManifestEntry {
  readonly fixture: string;
  readonly codes: readonly string[];
}

export default IManifestEntry;
