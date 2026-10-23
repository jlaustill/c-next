/**
 * #1610: every MISRA guideline docs/misra-compliance.md calls **Enforced** or
 * **By Design** names a guard in `MISRA_GUARDS`, and every guard it names
 * exists. Pure: the caller reads the files, so the unit tests can hand it a
 * repository that is wrong in exactly one way.
 */

import MisraRows from "./MisraRows";
import type IMisraGuardContext from "./types/IMisraGuardContext";
import type IMisraGuardViolation from "./types/IMisraGuardViolation";
import type IMisraRow from "./types/IMisraRow";
import type TMisraGuard from "./types/TMisraGuard";

/** The statuses that claim compliance, so a regression would make them false */
const CLAIMS = new Set<string>(["Enforced", "By Design"]);

class MisraGuards {
  static evaluate(
    document: string,
    registry: ReadonlyMap<string, readonly TMisraGuard[]>,
    context: IMisraGuardContext,
  ): { rows: IMisraRow[]; violations: IMisraGuardViolation[] } {
    const rows = MisraRows.parse(document);
    const claiming = new Set(
      rows.filter((row) => CLAIMS.has(row.status)).map((row) => row.id),
    );
    const violations: IMisraGuardViolation[] = [];

    for (const id of claiming) {
      if ((registry.get(id) ?? []).length === 0) {
        violations.push({
          id,
          detail: "claims compliance but names no guard in MISRA_GUARDS",
        });
      }
    }
    for (const [id, guards] of registry) {
      if (!claiming.has(id)) {
        violations.push({
          id,
          detail:
            "has a guard but its row is not Enforced or By Design; remove the entry",
        });
        continue;
      }
      for (const guard of guards) {
        const problem = MisraGuards.problem(id, guard, context);
        if (problem !== null) violations.push({ id, detail: problem });
      }
    }
    return { rows, violations };
  }

  /** Why one guard would not fail on a regression, or null when it would */
  static problem(
    id: string,
    guard: TMisraGuard,
    context: IMisraGuardContext,
  ): string | null {
    switch (guard.kind) {
      case "cppcheck": {
        const rule = guard.rule ?? id;
        if (rule.startsWith("Dir")) {
          return "cppcheck's addon checks no directive";
        }
        return context.baselined.has(`misra-c2012-${rule}`)
          ? `cppcheck rule ${rule} is baselined, so validate:c passes its violations`
          : null;
      }
      case "dump":
        return context.dumpRules.includes(guard.rule)
          ? null
          : `MisraDump checks no ${guard.rule}`;
      case "compile-flag":
        // g++ names the flag that rejected the unit: `-Werror=zero-as-...`
        return context.compileProbe.includes(`-Werror=${guard.flag.slice(2)}`)
          ? null
          : `the integration compile does not reject the probe with ${guard.flag}`;
      case "diagnostic":
        return context.assertedCodes.has(guard.code)
          ? null
          : `no .expected.error asserts ${guard.code}`;
      case "script":
        return context.scripts.has(guard.script)
          ? null
          : `package.json has no "${guard.script}" script`;
      case "issue":
        if (!Number.isInteger(guard.issue) || guard.issue <= 0) {
          return "names no issue number";
        }
        return context.openIssues.has(guard.issue)
          ? null
          : `issue #${guard.issue} is closed; replace it with the guard it delivered`;
    }
  }

  /** Every issue an `issue` guard names, for the caller to look up */
  static issues(
    registry: ReadonlyMap<string, readonly TMisraGuard[]>,
  ): number[] {
    const issues = new Set<number>();
    for (const guards of registry.values()) {
      for (const guard of guards) {
        if (guard.kind === "issue") issues.add(guard.issue);
      }
    }
    return [...issues];
  }

  /** Rules a `cppcheck` guard relies on, for `validate:c` to check its addon has */
  static addonRules(
    registry: ReadonlyMap<string, readonly TMisraGuard[]>,
  ): string[] {
    const rules = new Set<string>();
    for (const [id, guards] of registry) {
      for (const guard of guards) {
        if (guard.kind === "cppcheck") rules.add(guard.rule ?? id);
      }
    }
    return [...rules];
  }
}

export default MisraGuards;
