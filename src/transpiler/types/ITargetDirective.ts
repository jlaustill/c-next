/**
 * ADR-049: one `#pragma <key> <value>...` line, as 1.2 Parse read it.
 *
 * Plain data, so 1.4 Resolve can settle the program's one target without a
 * parse tree. The key and values are as written; judging them is 1.4's job.
 */
interface ITargetDirective {
  readonly key: string;
  readonly values: readonly string[];
  readonly line: number;
  readonly column: number;
}

export default ITargetDirective;
