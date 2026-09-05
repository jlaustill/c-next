import type { CommonTokenStream } from "antlr4ng";
import type * as Parser from "../logic/parser/grammar/CNextParser";

/**
 * What 1.2 Parse produces for one file: syntax, and nothing derived from it.
 *
 * Named rather than passed as a loose triple because it is the boundary between
 * 1.2 and 1.3 -- "one tree per file, per run" is the rule this carries, and a
 * pass that needs the tree takes this instead of re-parsing.
 *
 * `declarationCount` rides along because it is a property of the parse and
 * nothing later can recover it without walking the tree again.
 */
interface IParsedFile {
  readonly tree: Parser.ProgramContext;
  readonly tokenStream: CommonTokenStream;
  readonly declarationCount: number;
}

export default IParsedFile;
