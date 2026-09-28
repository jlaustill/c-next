/**
 * A cross-target transpile (#1668 box 15): the target to transpile for, and
 * the root of the mirrored tree it runs in (the directory holding its copy of
 * `tests/`). The CLI writes each helper's output beside the helper, so a cross
 * run needs a tree of its own; in `tests/` it would overwrite the host's
 * generated files. The transpile runs from that root, as the host's runs from
 * the project's.
 */
interface ITranspileCell {
  readonly target: string;
  readonly root: string;
}

export default ITranspileCell;
