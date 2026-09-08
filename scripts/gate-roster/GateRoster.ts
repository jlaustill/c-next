/**
 * Issue #1526: CLAUDE.md's gate roster is a list that reads as complete.
 *
 * It has drifted twice in silence (24 -> 26, 26 -> 27), and the command it
 * offered as "the count that cannot drift" was itself wrong twice in ways that
 * cancelled. A paragraph cannot assert its own correctness, so this derives it.
 *
 * Four properties, each failing on a drift that has actually happened:
 *
 *   count-mismatch     the numeral in CLAUDE.md != `run_check` invocations
 *   missing-from-gate  CI runs an npm script `gate.sh` neither runs nor excludes
 *   roster-mismatch    `gate.sh` runs a script the roster paragraph never names
 *   stale-exclusion    an exclusion names a script CI no longer runs
 *
 * KNOWN LIMIT. Comparison is by npm script name, so two CI steps invoking the
 * SAME script are one entry here -- `npm test` and the warm re-run that also
 * shells `npm test` are indistinguishable to `missing-from-gate`. The count
 * property is what covers that case, since both are separate `run_check` calls.
 * Naming the limit rather than implying total coverage: a guard that overstates
 * its reach is the failure this whole check exists to catch.
 */

import IGateRosterOutcome from "../types/IGateRosterOutcome";
import IGateRosterViolation from "../types/IGateRosterViolation";

const NPM_RUN = /\bnpm\s+run\s+([A-Za-z0-9:_-]+)/g;
const NPM_TEST = /\bnpm\s+test\b/g;
const NPX_BIN = /\bnpx\s+([A-Za-z0-9@/._-]+)/g;
const EXCLUSION = /^#\s*not-in-gate:\s*(\S+)\s+(.*)$/;

const UNITS: Record<string, number> = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
};
const TENS: Record<string, number> = {
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
};

/** Parse a spelled-out numeral such as `twenty-nine`. Null when unreadable. */
function numeralToInt(word: string): number | null {
  const lower = word.toLowerCase().trim();
  if (lower in UNITS) return UNITS[lower];
  if (lower in TENS) return TENS[lower];
  const parts = lower.split("-");
  if (parts.length !== 2) return null;
  const tens = TENS[parts[0]];
  const unit = UNITS[parts[1]];
  if (tens === undefined || unit === undefined || unit >= 10) return null;
  return tens + unit;
}

/**
 * Every npm script a blob of shell invokes.
 *
 * `npm ci` is deliberately absent: it installs, it does not check, and CI runs
 * it once per job. Counting it would make every job look like a missing check.
 */
function scriptsIn(text: string): string[] {
  const found = new Set<string>();
  for (const raw of text.split("\n")) {
    // A script NAMED in output or a comment is not a script that RUNS. The
    // workflow's Verify Clean step echoes "run 'npm run test:update' first" as
    // remediation advice, and reading that as an executed check reported a
    // missing gate entry for a command CI never invokes.
    const line = raw.trim();
    if (line.startsWith("#")) continue;
    if (/^(echo|printf)\b/.test(line)) continue;
    for (const match of line.matchAll(NPM_RUN)) found.add(match[1]);
    for (const _ of line.matchAll(NPM_TEST)) found.add("test");
    for (const match of line.matchAll(NPX_BIN)) found.add(`npx:${match[1]}`);
  }
  return [...found];
}

/** Join shell continuations so a `run_check ... \` line is read whole. */
function logicalLines(shell: string): string[] {
  const joined: string[] = [];
  let pending = "";
  for (const line of shell.split("\n")) {
    const carried = pending + line;
    if (carried.endsWith("\\")) {
      pending = `${carried.slice(0, -1)} `;
      continue;
    }
    joined.push(carried);
    pending = "";
  }
  if (pending !== "") joined.push(pending);
  return joined;
}

/** `run_check` invocations in `gate.sh` -- the definition line is not one. */
function gateInvocations(shell: string): string[] {
  return logicalLines(shell).filter((line) => line.startsWith('run_check "'));
}

/** The `# not-in-gate:` list, as script -> reason. */
function gateExclusions(shell: string): Map<string, string> {
  const found = new Map<string, string>();
  for (const line of shell.split("\n")) {
    const match = EXCLUSION.exec(line.trim());
    if (match !== null) found.set(match[1], match[2].trim());
  }
  return found;
}

/**
 * Every npm script a workflow's `run:` steps invoke, inline or block.
 *
 * Indentation decides where a block scalar ends, so the parser tracks the
 * `run:` key's own indent rather than assuming a fixed depth.
 */
function workflowScripts(yaml: string): string[] {
  const found = new Set<string>();
  const lines = yaml.split("\n");
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const inline = /^(\s*)-?\s*run:\s*(\S.*)$/.exec(line);
    if (inline !== null && inline[2] !== "|" && inline[2] !== ">") {
      for (const script of scriptsIn(inline[2])) found.add(script);
      continue;
    }
    const block = /^(\s*)-?\s*run:\s*[|>]\s*$/.exec(line);
    if (block === null) continue;
    const indent = block[1].length;
    for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
      const body = lines[cursor];
      if (body.trim() === "") continue;
      const bodyIndent = body.length - body.trimStart().length;
      if (bodyIndent <= indent) break;
      for (const script of scriptsIn(body)) found.add(script);
    }
  }
  return [...found];
}

const CHECK_NAME = /^run_check\s+"[^"]*"\s+"([^"]+)"/;
const ROSTER_START = "**`test:all` is ";
const COUNT_SENTENCE = /`test:all` is four checks of ([a-z-]+)/;
const REMAINDER_SENTENCE = /CI runs ([a-z-]+) more with no local/;

/**
 * The check name each `run_check` line declares, as base plus optional
 * parenthetical qualifier.
 *
 * #1322 review: this used to return `match[1].split(" (")[0]`, which reduced
 * `typecheck (scripts)` to `typecheck` -- a name the paragraph already
 * contained for a DIFFERENT check. So `roster-mismatch`, added by #1526 to
 * catch "an added check that nobody mentioned", could not see the very next
 * check that was added. A guard that passes by coincidence is the shape this
 * file exists to remove, so the qualifier is kept and asked for separately.
 */
function gateCheckNames(shell: string): { base: string; qualifier: string }[] {
  const names: { base: string; qualifier: string }[] = [];
  for (const line of gateInvocations(shell)) {
    const match = CHECK_NAME.exec(line);
    if (match === null) continue;
    const declared = match[1].trim();
    const open = declared.indexOf(" (");
    names.push(
      open === -1
        ? { base: declared, qualifier: "" }
        : {
            base: declared.slice(0, open).trim(),
            qualifier: declared
              .slice(open + 2)
              .replace(/\)$/, "")
              .trim(),
          },
    );
  }
  return names;
}

/** The roster paragraph: from its opening bold sentence to the blank line. */
function rosterParagraph(claudeMd: string): string {
  const start = claudeMd.indexOf(ROSTER_START);
  if (start === -1) return "";
  const end = claudeMd.indexOf("\n\n", start);
  return end === -1 ? claudeMd.slice(start) : claudeMd.slice(start, end);
}

/**
 * Compare what runs against what CLAUDE.md says runs.
 *
 * Pure: callers supply the three file contents, so the unit suite can drive
 * every rule without a fixture repository on disk.
 *
 * `roster-mismatch` asks only whether the paragraph CONTAINS each check name,
 * not that it reads well. A substring test cannot tell `test` from `test:cli`,
 * which is why it is scoped to catching an added check that nobody mentioned --
 * the drift that actually happened -- and not sold as proving the prose right.
 *
 * It asks for the parenthetical qualifier separately (#1322 review). Stripping
 * it made `typecheck (scripts)` indistinguishable from `typecheck`, so the
 * first check added after this guard shipped went unmentioned and unreported.
 */
function evaluate(
  shell: string,
  yaml: string,
  claudeMd: string,
): IGateRosterOutcome {
  const invocations = gateInvocations(shell);
  const gateScripts = scriptsIn(shell);
  const workflow = workflowScripts(yaml);
  const exclusions = gateExclusions(shell);
  const paragraph = rosterParagraph(claudeMd);
  const violations: IGateRosterViolation[] = [];

  const countMatch = COUNT_SENTENCE.exec(claudeMd);
  const claimedCount = countMatch === null ? null : numeralToInt(countMatch[1]);

  if (claimedCount === null) {
    violations.push({
      kind: "count-mismatch",
      detail:
        "CLAUDE.md's `test:all is four checks of <numeral>` sentence could not be read",
    });
  } else if (claimedCount !== invocations.length) {
    violations.push({
      kind: "count-mismatch",
      detail: `CLAUDE.md claims ${claimedCount} checks; gate.sh runs ${invocations.length}`,
    });
  }

  const remainderMatch = REMAINDER_SENTENCE.exec(claudeMd);
  const claimedRemainder =
    remainderMatch === null ? null : numeralToInt(remainderMatch[1]);
  const expectedRemainder = invocations.length - 4;
  if (claimedRemainder !== null && claimedRemainder !== expectedRemainder) {
    violations.push({
      kind: "count-mismatch",
      detail: `CLAUDE.md claims CI runs ${claimedRemainder} beyond test:all; gate.sh implies ${expectedRemainder}`,
    });
  }

  for (const script of workflow) {
    if (gateScripts.includes(script)) continue;
    if (exclusions.has(script)) continue;
    violations.push({
      kind: "missing-from-gate",
      detail: `pr-checks.yml runs \`${script}\`; gate.sh neither runs nor excludes it`,
    });
  }

  for (const script of exclusions.keys()) {
    if (workflow.includes(script)) continue;
    violations.push({
      kind: "stale-exclusion",
      detail: `gate.sh excludes \`${script}\`, which pr-checks.yml no longer runs`,
    });
  }

  for (const { base, qualifier } of gateCheckNames(shell)) {
    // Both halves must appear. The base alone cannot distinguish two
    // parenthetical variants of one check, which is how `typecheck (scripts)`
    // went unmentioned while this rule reported clean.
    const named =
      paragraph.includes(base) &&
      (qualifier === "" || paragraph.includes(qualifier));
    if (named) continue;
    const spelled = qualifier === "" ? base : `${base} (${qualifier})`;
    violations.push({
      kind: "roster-mismatch",
      detail: `gate.sh runs \`${spelled}\`; CLAUDE.md's roster never names it`,
    });
  }

  return {
    checkCount: invocations.length,
    gateScripts,
    workflowScripts: workflow,
    exclusions: [...exclusions.entries()],
    claimedCount,
    violations,
  };
}

export default class GateRoster {
  static numeralToInt = numeralToInt;
  static scriptsIn = scriptsIn;
  static logicalLines = logicalLines;
  static gateInvocations = gateInvocations;
  static gateExclusions = gateExclusions;
  static workflowScripts = workflowScripts;
  static gateCheckNames = gateCheckNames;
  static rosterParagraph = rosterParagraph;
  static evaluate = evaluate;
}
