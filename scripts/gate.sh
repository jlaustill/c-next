#!/bin/bash
# Every check CI runs that can run locally, mapped to the job that runs it.
#
# `test:all` is build + unit + test:q + validate:c -- four of these. The rest
# live in CI jobs with no local alias, so a green `test:all` said nothing about
# them and #1399 pushed a branch that turned CI red on
# `docs:throw-citations:check`. This is that missing alias.
#
# Runs everything and summarizes rather than stopping at the first failure:
# when you are chasing green you want the whole list, not one line of it.
#
# Every npm script CI runs that this file deliberately does NOT run is listed
# below, with its reason. `npm run gate:roster:check` reads these lines, so a
# check added to `pr-checks.yml` and forgotten here fails the lint job rather
# than going unnoticed -- which is how `headers:standalone:check` sat outside
# the roster.
#
# not-in-gate: antlr:all  regenerates the parser; CI runs it in `build`, and the
#              working-tree check below catches a stale one
#
# Sonar and Deploy Coverage need tokens and run no npm script, so they are not
# npm scripts to exclude -- they never enter the comparison.

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT" || exit 1

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

FAILED=()
PASSED=0
LOG_DIR="$(mktemp -d)"
trap 'rm -rf "$LOG_DIR"' EXIT

run_check() {
  local job="$1" name="$2"
  shift 2
  local log="$LOG_DIR/${name//[^a-zA-Z0-9]/_}.log"
  printf '  %-34s ' "$name"
  if "$@" >"$log" 2>&1; then
    printf "${GREEN}pass${NC}\n"
    PASSED=$((PASSED + 1))
  else
    printf "${RED}FAIL${NC}\n"
    FAILED+=("$job|$name|$log")
  fi
}

echo -e "${BLUE}=== C-Next full gate (every CI check that runs locally) ===${NC}"

echo -e "\n${YELLOW}Static Analysis${NC}"
run_check "Static Analysis" "prettier:check"             npm run prettier:check
run_check "Static Analysis" "plugin:test"                npm run plugin:test
run_check "Static Analysis" "test:hooks"                 npm run test:hooks
run_check "Static Analysis" "cspell:check"               npm run cspell:check
run_check "Static Analysis" "oxlint:check"               npm run oxlint:check
run_check "Static Analysis" "knip"                       npx knip
run_check "Static Analysis" "depcruise"                  npm run depcruise
run_check "Static Analysis" "lint:test-location"         npm run lint:test-location
run_check "Static Analysis" "analyze:duplication"        npm run analyze:duplication
run_check "Static Analysis" "docs:toolchain:check"       npm run docs:toolchain:check
run_check "Static Analysis" "coverage:matrix:check"      npm run coverage:matrix:check
run_check "Static Analysis" "diagnostics:manifest:check" npm run diagnostics:manifest:check
run_check "Static Analysis" "docs:throw-citations:check" npm run docs:throw-citations:check
run_check "Static Analysis" "scope-joins:check"          npm run scope-joins:check
run_check "Static Analysis" "adr:independence:check"     npm run adr:independence:check
run_check "Static Analysis" "gh:pagination:check"        npm run gh:pagination:check
run_check "Static Analysis" "gate:roster:check"         npm run gate:roster:check

echo -e "\n${YELLOW}Build${NC}"
run_check "Build" "build"                                npm run build
run_check "Build" "typecheck"                            npm run typecheck
run_check "Build" "typecheck (prettier-plugin)"          npx tsc --noEmit -p prettier-plugin/tsconfig.json

echo -e "\n${YELLOW}Tests${NC}"
run_check "Unit Tests"        "unit"                     npm run unit
run_check "Integration Tests" "test"                     npm test
# Issue #1225: the run above populates .cnx/, so this one reads it. A cold
# cache is all CI used to see, which is how four cache-fidelity bugs reached
# main green. --transpile-only skips compile/execute: the divergence is in
# generated text, so transpile plus snapshot comparison catches it in full.
run_check "Integration Tests" "re-run warm" \
  bash -c 'npm test -- --transpile-only && git diff --exit-code tests/'
run_check "CLI Tests"         "test:cli"                 npm run test:cli
# Writes into examples/ ON PURPOSE, matching what CI's "Verify transpiler CLI"
# step does. The committed example output is generated but nothing compared it,
# so it drifted: a bitmap comment block moved from the .h to the .c and
# examples/teensy4 kept the old shape. Writing in place makes `working tree
# clean` below catch that; a temp directory would run the CLI and prove nothing
# about the committed files.
run_check "CLI Tests"         "cli smoke" \
  bash -c 'node dist/index.js examples/teensy4/blink.cnx && test -f examples/teensy4/blink.c'
run_check "Grammar Coverage"  "coverage:grammar:check"   npm run coverage:grammar:check -- --threshold 80
run_check "Format Fidelity"   "format:fidelity"          npm run format:fidelity

echo -e "\n${YELLOW}C Static Analysis${NC}"
run_check "C Static Analysis" "validate:c"               npm run validate:c
run_check "Integration Tests" "headers:standalone:check"  npm run headers:standalone:check

# Mirrors the Verify Clean job: the suite regenerates .test.c/.test.h, and a
# generated file that is missing, stale or untracked shows up here. This is what
# catches a `rm` glob that swept a committed artifact into a deletion.
#
# Goes through run_check like every other check, rather than open-coding the
# pass/fail bookkeeping. Hand-rolled, it was the one check `grep -c '^run_check'`
# could not see -- which is how that command came to be wrong twice in ways that
# cancelled: it counted the function definition and missed this.
echo -e "\n${YELLOW}Verify Clean${NC}"
run_check "Verify Clean" "working tree clean" \
  bash -c 'DIRTY="$(git status --porcelain)"; [ -z "$DIRTY" ] || { echo "$DIRTY"; echo "-- $(echo "$DIRTY" | wc -l) entries; run: git status"; exit 1; }'

echo ""
if [ ${#FAILED[@]} -eq 0 ]; then
  echo -e "${GREEN}All $PASSED checks passed.${NC}"
  exit 0
fi

echo -e "${RED}${#FAILED[@]} failed, $PASSED passed:${NC}"
for entry in "${FAILED[@]}"; do
  IFS='|' read -r job name log <<< "$entry"
  echo -e "  ${RED}✗${NC} $name  ${BLUE}(CI job: $job)${NC}"
  [ -n "$log" ] && [ -f "$log" ] && tail -6 "$log" | sed 's/^/      /'
done
exit 1
