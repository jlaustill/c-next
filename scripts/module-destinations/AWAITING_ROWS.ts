/**
 * The `awaiting #NNNN` rows `docs/architecture/module-destinations.md` may hold
 * (#1653, owner ruling 17: the set may not grow).
 *
 * An `awaiting` row is allowed, never a failure as such. Each entry is a row's
 * path, spelled as the map spells it, and the number of modules it covers. A
 * count that rises fails: a module landed under a glob undecided. A count that
 * falls, or an entry the map no longer reads as `awaiting`, fails too, so an
 * allowance cannot outlive its modules (#1826 review: the ratchet used to count
 * pattern strings, which a glob row made blind).
 */
const AWAITING_ROWS: Readonly<Record<string, number>> = {
  "src/utils/cache/**": 4,
  "src/transpiler/Transpiler.ts": 1,
  "src/transpiler/types/**": 4,
  "src/index.ts": 1,
  "src/tests/utils/FunctionUtils.ts": 1,
};

export default AWAITING_ROWS;
