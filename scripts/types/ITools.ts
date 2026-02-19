/**
 * Available validation tools on the system
 *
 * Static analysis tools (cppcheck, clang-tidy, MISRA, flawfinder) run as a
 * separate batch step via `npm run validate:c` / scripts/batch-validate.mjs,
 * not during per-file integration tests.
 */
interface ITools {
  gcc: boolean;
}

export default ITools;
