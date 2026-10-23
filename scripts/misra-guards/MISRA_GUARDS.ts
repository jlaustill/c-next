/**
 * The regression guard for every **Enforced** and **By Design** row of
 * docs/misra-compliance.md (#1610). `npm run docs:misra-guards:check` fails
 * when such a row has no entry here, when an entry names a guard that does
 * not exist, and when an entry is left behind for a row that no longer claims
 * compliance. A row whose guard is only an `issue` has none yet: the issue is
 * the work of adding one.
 *
 * #1610 is why: Rule 11.9 read **By Design** while generated C wrote
 * `Dev* d = {0};` at six sites, because nothing failed when it did.
 */

import type TMisraGuard from "./types/TMisraGuard";

const cppcheck: TMisraGuard = { kind: "cppcheck" };

function diagnostic(code: string): TMisraGuard {
  return { kind: "diagnostic", code };
}

function issue(number: number): TMisraGuard {
  return { kind: "issue", issue: number };
}

const MISRA_GUARDS: ReadonlyMap<string, readonly TMisraGuard[]> = new Map<
  string,
  readonly TMisraGuard[]
>([
  // Every generated unit compiles with -Werror in every target cell
  ["Dir 2.1", [{ kind: "script", script: "test" }]],
  ["Dir 3.1", [issue(2312)]],
  ["Dir 4.1", [issue(2313)]],
  ["Dir 4.3", [issue(2314)]],
  ["Dir 4.6", [issue(2315)]],
  ["Dir 4.7", [diagnostic("E0901")]],
  ["Dir 4.8", [issue(2316)]],
  ["Dir 4.10", [issue(2317)]],
  // No stdlib memory function is emitted: the addon's Rule 21.3
  ["Dir 4.12", [{ kind: "cppcheck", rule: "21.3" }]],
  ["1.1", [issue(2318)]],
  ["3.1", [cppcheck]],
  ["3.2", [cppcheck]],
  ["4.1", [cppcheck]],
  ["4.2", [cppcheck]],
  ["5.1", [cppcheck, diagnostic("E0204")]],
  // The addon's 5.8 is baselined (#1063); E0204 is what fails
  ["5.8", [diagnostic("E0204")]],
  ["6.1", [cppcheck]],
  ["6.2", [cppcheck]],
  ["7.1", [cppcheck, diagnostic("E0912")]],
  ["7.3", [cppcheck]],
  ["8.1", [cppcheck]],
  ["8.2", [cppcheck]],
  ["8.3", [issue(2319)]],
  ["8.4", [cppcheck]],
  // Baselined: generated C still violates them
  ["8.5", [issue(1064)]],
  ["8.6", [issue(1059)]],
  ["8.10", [cppcheck]],
  ["8.13", [diagnostic("E0899")]],
  ["8.14", [cppcheck]],
  ["9.2", [issue(1072)]],
  ["9.3", [cppcheck]],
  ["9.4", [cppcheck]],
  ["9.5", [cppcheck]],
  ["11.1", [cppcheck]],
  ["11.2", [cppcheck]],
  ["11.5", [cppcheck]],
  ["11.6", [cppcheck]],
  ["11.7", [cppcheck]],
  ["11.8", [cppcheck]],
  // The addon sees `p = 0` and `p == 0` but not `p = {0}`; the dump check
  // sees that, and the C++ compile rejects a literal 0 used as a null
  [
    "11.9",
    [
      cppcheck,
      { kind: "dump", rule: "misra-c2012-11.9" },
      { kind: "compile-flag", flag: "-Wzero-as-null-pointer-constant" },
    ],
  ],
  ["12.3", [cppcheck]],
  ["13.4", [cppcheck]],
  ["13.5", [cppcheck, diagnostic("E0702")]],
  ["13.6", [cppcheck, diagnostic("E0603")]],
  ["15.1", [cppcheck]],
  ["15.2", [cppcheck]],
  ["15.3", [cppcheck]],
  ["16.1", [cppcheck]],
  ["16.2", [cppcheck]],
  ["16.3", [cppcheck]],
  ["16.4", [cppcheck]],
  ["16.6", [cppcheck, diagnostic("E0712")]],
  ["16.7", [cppcheck, diagnostic("E0711")]],
  ["17.1", [cppcheck]],
  ["17.3", [cppcheck]],
  ["17.5", [issue(2320)]],
  ["17.6", [cppcheck]],
  ["17.7", [cppcheck, diagnostic("E0708")]],
  ["17.8", [cppcheck]],
  ["18.1", [issue(2321)]],
  ["18.2", [issue(2322)]],
  ["18.3", [issue(2323)]],
  ["18.5", [cppcheck]],
  ["18.7", [cppcheck]],
  ["18.8", [cppcheck]],
  ["20.3", [cppcheck]],
  ["20.5", [cppcheck]],
  // The addon has no 20.6; a function-like macro is E0501
  ["20.6", [diagnostic("E0501")]],
  ["20.7", [cppcheck, diagnostic("E0501")]],
  ["20.8", [cppcheck]],
  ["20.9", [cppcheck]],
  ["20.10", [cppcheck, diagnostic("E0502"), diagnostic("E0501")]],
  ["20.11", [cppcheck, diagnostic("E0501")]],
  ["20.12", [cppcheck, diagnostic("E0501")]],
  ["20.13", [cppcheck]],
  ["20.14", [cppcheck]],
  ["21.3", [cppcheck]],
  // No free(): the addon's Rule 21.3 forbids it
  ["22.2", [{ kind: "cppcheck", rule: "21.3" }]],
  ["22.5", [cppcheck]],
]);

export default MISRA_GUARDS;
