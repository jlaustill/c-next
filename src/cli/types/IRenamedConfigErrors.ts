import type ITranspileError from "../../cnx/types/ITranspileError";

/**
 * The config walk met a file under an old name (#2165): E0918 for each, and
 * no config is loaded. A renamed project's settings are never dropped with
 * no diagnostic.
 */
interface IRenamedConfigErrors {
  readonly kind: "renamed";
  readonly errors: readonly ITranspileError[];
}

export default IRenamedConfigErrors;
