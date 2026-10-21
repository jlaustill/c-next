import { ProgramContext } from "../../../src/cnx/PARSE/2-Parse/grammar/CnxParser";

/**
 * The parse-tree root handed to Prettier.
 *
 * Comments are not carried here: they are anchored to individual tokens during
 * parsing, so Prettier's own comment attachment stays out of the picture.
 */
type TCstRoot = ProgramContext;

export default TCstRoot;
