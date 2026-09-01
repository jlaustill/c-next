#!/usr/bin/env bash
#
# Tests for the start-issue assignment reminder hook (issue #1423).
#
# Run: bash .claude/hooks/__tests__/start-issue-assign-reminder.test.sh
#
# The no-fire cases are the point. An assertion that the hook fires proves it is not
# dead; only a case that must stay SILENT proves it is not firing on everything, which
# would train the reader to ignore it. See CLAUDE.md, "Negative controls in error
# fixtures" — the same argument applies to a prompt matcher.

set -uo pipefail

HOOK="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/start-issue-assign-reminder.sh"
pass=0
fail=0

run_hook() {
  printf '%s' "$1" \
    | jq -Rs '{hook_event_name: "UserPromptSubmit", prompt: .}' \
    | bash "$HOOK"
}

# expect_fire <prompt> <issue-number>
expect_fire() {
  local prompt="$1" want="$2" out
  out=$(run_hook "$prompt")
  if printf '%s' "$out" | grep -q "issue #${want} as work to start" \
     && printf '%s' "$out" | grep -q -- "--add-assignee jlaustill"; then
    pass=$((pass + 1))
    printf '  ok      fires on #%s: %s\n' "$want" "$prompt"
  else
    fail=$((fail + 1))
    printf '  FAIL    expected fire on #%s: %s\n' "$want" "$prompt"
  fi
}

# expect_silent <prompt>
expect_silent() {
  local prompt="$1" out
  out=$(run_hook "$prompt")
  if [ -z "$out" ]; then
    pass=$((pass + 1))
    printf '  ok      silent: %s\n' "$prompt"
  else
    fail=$((fail + 1))
    printf '  FAIL    expected silence: %s\n' "$prompt"
    printf '          got: %s\n' "$(printf '%s' "$out" | head -3)"
  fi
}

echo "Fires:"
expect_fire "start on #1234" 1234
expect_fire "Start #99" 99
expect_fire "let's begin work on #7" 7
expect_fire "work on #1234" 1234
expect_fire "working on #56 today" 56
expect_fire "ok, start on #1423 please" 1423
expect_fire "begin #204" 204

echo "Silent:"
expect_silent "see PR #1234"
expect_silent "restart on #5"
expect_silent "#1234"
expect_silent "what should I work on"
expect_silent "the fix for #1234 shipped in v0.2.7"
expect_silent "close #1234"
expect_silent "review #1234"
expect_silent "kickstart on #5"

echo "Multiple:"
out=$(run_hook "start on #12 and then work on #34")
if printf '%s' "$out" | grep -q "issue #12 as work" \
   && printf '%s' "$out" | grep -q "issue #34 as work"; then
  pass=$((pass + 1)); echo "  ok      names both #12 and #34"
else
  fail=$((fail + 1)); echo "  FAIL    expected both #12 and #34"
fi

echo "Never fails hard:"
out=$(printf 'not json at all' | bash "$HOOK"); rc=$?
if [ $rc -eq 0 ]; then
  pass=$((pass + 1)); echo "  ok      exits 0 on malformed payload"
else
  fail=$((fail + 1)); echo "  FAIL    exited $rc on malformed payload"
fi

echo
echo "passed: $pass   failed: $fail"
[ "$fail" -eq 0 ]
