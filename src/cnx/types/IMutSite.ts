/**
 * Where `mut` belongs for a binding E0900 or E0879 names (ADR-071): the start
 * of its declaration, in the file that declares it. A tool that rewrites code
 * to the rule, such as `scripts/migrate-adr-071.ts`, inserts the keyword there.
 */
interface IMutSite {
  readonly sourcePath: string;
  readonly line: number;
  readonly column: number;
}

export default IMutSite;
