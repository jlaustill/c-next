/**
 * ADR-024: Type classification for safe casting.
 *
 * Built from the two lists rather than respelling them. #1450: this module
 * declared its own `UNSIGNED_TYPES` and `SIGNED_TYPES` consts, byte-identical
 * to the sibling modules of those names sitting beside it, so each list lived
 * in two files and a new integer width would have had to be added to both --
 * with `INTEGER_TYPES` silently disagreeing with `UNSIGNED_TYPES` if it were
 * not. Nothing would have failed.
 */
import UNSIGNED_TYPES from "./UNSIGNED_TYPES";
import SIGNED_TYPES from "./SIGNED_TYPES";

const INTEGER_TYPES = [...UNSIGNED_TYPES, ...SIGNED_TYPES] as const;

export default INTEGER_TYPES;
