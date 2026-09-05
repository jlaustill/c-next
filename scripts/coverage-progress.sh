#!/bin/bash
# C-Next Test Coverage Progress Tracker
# Run this script anytime to see current coverage status

set -e

# Count open issues, optionally filtered to one label.
#
# One definition for all six call sites. Each used to inline its own
# `gh api .../issues?...`, which carried two defects six times over: the REST
# endpoint pages at 30 with no `--paginate`, so this printed `Open Issues: 30`
# against a true 257; and `/issues` returns pull requests too, so even the
# capped number conflated them. `gh issue list` excludes PRs natively and
# `--limit` is the bound (#1416).
open_issue_count() {
    if [[ -n "${1:-}" ]]; then
        gh issue list --state open --limit 1000 --label "$1" \
            --json number --jq 'length' 2>/dev/null || echo 0
    else
        gh issue list --state open --limit 1000 \
            --json number --jq 'length' 2>/dev/null || echo 0
    fi
}

echo "========================================"
echo "  C-Next Test Coverage - Progress"
echo "========================================"
echo ""

# Coverage stats from coverage.md
TOTAL_BOXES=$(grep -c "\[.\]" coverage.md)
CHECKED=$(grep -c "\[x\]" coverage.md)
UNCHECKED=$(grep -c "\[ \]" coverage.md)
COVERAGE_PCT=$((CHECKED * 100 / TOTAL_BOXES))

echo "📊 Coverage Statistics:"
echo "  Total Test Points:  $TOTAL_BOXES"
echo "  Covered (✅):        $CHECKED ($COVERAGE_PCT%)"
echo "  Uncovered (❌):      $UNCHECKED ($((100 - COVERAGE_PCT))%)"
echo ""

# Progress bar
FILLED=$((COVERAGE_PCT / 2))
EMPTY=$((50 - FILLED))
printf "  ["
printf "%${FILLED}s" | tr ' ' '='
printf "%${EMPTY}s" | tr ' ' '-'
printf "] $COVERAGE_PCT%%\n"
echo ""

# Skipped tests
SKIPPED=$(find tests -name "*.test.cnx.skip" 2>/dev/null | wc -l)
echo "⏸️  Skipped Tests:      $SKIPPED (blocked by bugs)"
echo ""

# GitHub Issues
if command -v gh &> /dev/null; then
    echo "🎫 GitHub Issues:"
    HIGH=$(open_issue_count "priority: high")
    MEDIUM=$(open_issue_count "priority: medium")
    LOW=$(open_issue_count "priority: low")
    OPEN_ISSUES=$(open_issue_count)

    echo "  Open Issues:        $OPEN_ISSUES"
    echo "    - HIGH:           $HIGH 🔴"
    echo "    - MEDIUM:         $MEDIUM 🟡"
    echo "    - LOW:            $LOW 🔵"
    echo ""

    echo "📅 Milestone: v1 Test Coverage Complete"
    MILESTONE_DATA=$(gh api repos/jlaustill/c-next/milestones/1 2>/dev/null)
    OPEN=$(echo "$MILESTONE_DATA" | jq -r '.open_issues')
    CLOSED=$(echo "$MILESTONE_DATA" | jq -r '.closed_issues')
    TOTAL=$((OPEN + CLOSED))
    MILESTONE_PCT=$((TOTAL > 0 ? CLOSED * 100 / TOTAL : 0))

    echo "  Due Date:           $(echo "$MILESTONE_DATA" | jq -r '.due_on' | cut -d'T' -f1)"
    echo "  Progress:           $CLOSED/$TOTAL issues closed ($MILESTONE_PCT%)"

    # Milestone progress bar
    FILLED=$((MILESTONE_PCT / 2))
    EMPTY=$((50 - FILLED))
    printf "  ["
    printf "%${FILLED}s" | tr ' ' '='
    printf "%${EMPTY}s" | tr ' ' '-'
    printf "] $MILESTONE_PCT%%\n"
    echo ""
fi

# Recent test changes
if [[ -d .git ]]; then
    echo "📝 Recent Test Activity:"
    RECENT_TESTS=$(git log --since="7 days ago" --oneline --name-only | grep "tests/.*\.test\.cnx$" | sort -u | wc -l)
    echo "  New/modified tests (7d): $RECENT_TESTS"

    # Show last test commit
    LAST_TEST_COMMIT=$(git log --oneline --grep="test" -1 --format="%h %s" 2>/dev/null || echo "None")
    echo "  Last test commit:        $LAST_TEST_COMMIT"
    echo ""
fi

echo "🔥 Priority Actions:"
if [[ "$SKIPPED" -gt 0 ]]; then
    echo "  ⚠️  $SKIPPED tests blocked by bugs (Issues #7, #8)"
fi

if command -v gh &> /dev/null; then
    TEST_BLOCKED=$(open_issue_count "test-blocked")
    if [[ "$TEST_BLOCKED" -gt 0 ]]; then
        echo "  🔨 Fix $TEST_BLOCKED bug(s) to unblock tests"
    fi

    GOOD_FIRST=$(open_issue_count "good first issue")
    if [[ "$GOOD_FIRST" -gt 0 ]]; then
        echo "  ✨ $GOOD_FIRST good first issue(s) available"
    fi
fi

echo ""
echo "📚 Resources:"
echo "  📄 Full report:     TEST-COVERAGE-REPORT.md"
echo "  📋 Coverage matrix: coverage.md"
echo "  🌐 GitHub issues:   https://github.com/jlaustill/c-next/issues"
echo "  🎯 Milestone:       https://github.com/jlaustill/c-next/milestone/1"
echo "========================================"
