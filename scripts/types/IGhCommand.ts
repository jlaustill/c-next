/**
 * One `gh` invocation lifted out of a file, with its continuation lines joined
 * (issue #1416).
 */
interface IGhCommand {
  /** 1-indexed line the invocation STARTS on, not where it ends. */
  line: number;
  /** The command from `gh` onward, continuation lines included. */
  text: string;
}

export default IGhCommand;
