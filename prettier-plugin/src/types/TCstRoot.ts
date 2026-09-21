import { ProgramContext } from "../../../src/PARSE/2-Parse/grammar/CNextParser";

/**
 * The parse-tree root handed to Prettier.
 *
 * Comments are not carried here: they are anchored to individual tokens during
 * parsing, so Prettier's own comment attachment stays out of the picture.
 */
type TCstRoot = ProgramContext;

export default TCstRoot;
