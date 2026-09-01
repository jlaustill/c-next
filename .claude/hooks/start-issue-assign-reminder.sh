#!/usr/bin/env bash
#
# UserPromptSubmit hook — issue #1423.
#
# Fires when the prompt says to start work on a numbered issue ("start on #1234").
# Emits a reminder that assignment is what moves the card to WIP, and names the
# command. Skill text is advisory and can be skipped; this cannot.
#
# It REMINDS ONLY. It performs no GitHub write, deliberately: the trigger is a regex
# over prompt text, so a typo'd number ("#1243" for "#1234") would otherwise assign a
# real person to an unrelated issue. Deciding to act on the reminder stays with the
# model, which can see whether the number makes sense.
#
# Contract: reads the hook payload as JSON on stdin, writes context to stdout, exits 0.
# A non-zero exit or a crash here would block every prompt, so this never fails hard.

set -uo pipefail

input=$(cat)

# jq is present wherever gh is, but a missing jq must not break prompting — fall back
# to scanning the raw payload, which costs only a little precision.
if command -v jq >/dev/null 2>&1; then
  prompt=$(printf '%s' "$input" | jq -r '.prompt // ""' 2>/dev/null) || prompt="$input"
else
  prompt="$input"
fi

# Match a start-work phrasing immediately followed by an issue reference:
#   "start on #1234"   "Start #99"   "let's begin work on #7"   "working on #12"
# The leading (^|[^[:alnum:]]) is a word boundary that keeps "restart on #5" out, and
# requiring a verb keeps a bare mention ("see PR #1234") out.
PATTERN='(^|[^[:alnum:]])((start|begin)([[:space:]]+work(ing)?)?[[:space:]]+(on[[:space:]]+)?|work(ing)?[[:space:]]+on[[:space:]]+)#[0-9]+'

numbers=$(printf '%s' "$prompt" \
  | grep -oiE "$PATTERN" 2>/dev/null \
  | grep -oE '[0-9]+$' \
  | sort -un) || true

[ -z "$numbers" ] && exit 0

for n in $numbers; do
  cat <<EOF
<system-reminder>
The prompt names issue #${n} as work to start.

An issue reaches the project board's WIP column ONLY by being assigned:
.github/workflows/project-sync.yml maps \`issues.assigned -> WIP\`. Nothing else moves
it, and before #1423 nothing ever did — the column had been empty since it was created.

Invoke the \`start-issue\` skill BEFORE reading code or creating a branch. Its Phase 1
runs:

    gh issue edit ${n} --add-assignee jlaustill

and its Phase 2 blocks until the board is re-queried and confirmed at WIP. Do not
report the card as moved because you assigned it; the sync is an async workflow run.
Do not write the board's Status field by hand — project-sync.yml owns that transition.
</system-reminder>
EOF
done

exit 0
