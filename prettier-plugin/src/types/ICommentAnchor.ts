import ICommentNode from "./ICommentNode";

/**
 * The comments anchored to one token.
 *
 * `before` are comments that stood on their own line(s) ahead of the token;
 * `after` are comments that sat on the same line as the token, after it.
 * Together they reproduce the original placement exactly.
 */
interface ICommentAnchor {
  before: ICommentNode[];
  after: ICommentNode[];
  /**
   * A blank line separated the last leading comment from the token.
   *
   * Each comment records the blank line *before* it, which leaves the gap
   * between the final comment and its token unrepresented -- and a file whose
   * header comments were followed by a blank line lost it, shifting every line
   * below and with it every `line:column` in a committed `.expected.error`.
   */
  blankLineBeforeToken: boolean;
  /**
   * This token opens the file.
   *
   * A leading comment is rendered on its own line, which means emitting a break
   * before it. At the very start of a file there is nothing to break from, and
   * doing it anyway opens every commented file with a blank line.
   */
  atFileStart: boolean;
}

export default ICommentAnchor;
