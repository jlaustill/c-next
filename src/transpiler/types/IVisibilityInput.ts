/**
 * What 1.4 Resolve needs to work out which files each file can see: the `.cnx`
 * include graph exactly as 1.1 discovery resolved it.
 *
 * `cnextIncludesByFile` maps a file to its DIRECT includes, in source order,
 * and a file with no entry includes nothing. Resolve takes the closure over
 * this map and never reads a file or builds a search path (#1435): the second
 * derivation it used to make re-read files from disk under a weaker search
 * path and the opposite cycle rule, and rejected programs discovery accepted.
 */
interface IVisibilityInput {
  readonly cnextIncludesByFile: ReadonlyMap<
    string,
    ReadonlyArray<{ path: string }>
  >;
}

export default IVisibilityInput;
