/**
 * #2163: the language's name before it was cnx, in both spellings, with the
 * hyphen and without. The pattern is an extended regular expression for
 * `git grep -E` and a JavaScript one alike, matched in any case by both, so the
 * guard over the tree and the check of `--help` cannot drift apart.
 */
class FormerName {
  /** @public read by `former-name.test.ts`, which hands it to `git grep` */
  static readonly PATTERN = "c-?next";

  /** Whether `text` spells the former name anywhere, in any case. */
  static isIn(text: string): boolean {
    return new RegExp(FormerName.PATTERN, "i").test(text);
  }
}

export default FormerName;
