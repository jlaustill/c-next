import { ProgramContext } from "../../../src/transpiler/logic/parser/grammar/CNextParser";

/**
 * The parse-tree root handed to Prettier.
 *
 * Comments are not carried here: they are anchored to individual tokens during
 * parsing, so Prettier's own comment attachment stays out of the picture.
 */
type TCstRoot = ProgramContext;

export default TCstRoot;
