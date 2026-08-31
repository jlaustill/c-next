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
# Not included, because they cannot run locally:
#   Sonar / Deploy Coverage  need tokens
#   antlr:all                regenerates the parser; CI runs it in `build`, and
#                            the working-tree check below catches a stale one

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

echo -e "\n${YELLOW}Build${NC}"
run_check "Build" "build"                                npm run build
run_check "Build" "typecheck"                            npm run typecheck
run_check "Build" "typecheck (prettier-plugin)"          npx tsc --noEmit -p prettier-plugin/tsconfig.json

echo -e "\n${YELLOW}Tests${NC}"
run_check "Unit Tests"        "unit"                     npm run unit
run_check "Integration Tests" "test"                     npm test
run_check "CLI Tests"         "test:cli"                 npm run test:cli
run_check "Grammar Coverage"  "coverage:grammar:check"   npm run coverage:grammar:check -- --threshold 80
run_check "Format Fidelity"   "format:fidelity"          npm run format:fidelity

echo -e "\n${YELLOW}C Static Analysis${NC}"
run_check "C Static Analysis" "validate:c"               npm run validate:c

# Mirrors the Verify Clean job: the suite regenerates .test.c/.test.h, and a
# generated file that is missing, stale or untracked shows up here. This is what
# catches a `rm` glob that swept a committed artifact into a deletion.
echo -e "\n${YELLOW}Verify Clean${NC}"
printf '  %-34s ' "working tree clean"
DIRTY="$(git status --porcelain)"
if [ -z "$DIRTY" ]; then
  printf "${GREEN}pass${NC}\n"
  PASSED=$((PASSED + 1))
else
  printf "${RED}FAIL${NC}\n"
  echo "$DIRTY" | sed 's/^/      /'
  FAILED+=("Verify Clean|working tree clean|")
fi

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
