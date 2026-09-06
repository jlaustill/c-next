/**
 * One source file's text before and after the edit being documented.
 *
 * #1518: the remap's whole safety argument rests on having BOTH. A fixer with
 * only the current text has to guess which throw a stale citation meant, and
 * nine sites in `output/` share a message; a fixer with the previous revision
 * counts them instead.
 */
interface IRevision {
  readonly previous: string;
  readonly current: string;
}

export default IRevision;
