#!/bin/bash
# C-Next Test Coverage Progress Tracker
# Run this script anytime to see current coverage status

set -e

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
    OPEN_ISSUES=$(gh api repos/jlaustill/c-next/issues?state=open 2>/dev/null | jq -r '.[] | .number' | wc -l)
    HIGH=$(gh api repos/jlaustill/c-next/issues?labels="priority:%20high" 2>/dev/null | jq '. | length')
    MEDIUM=$(gh api repos/jlaustill/c-next/issues?labels="priority:%20medium" 2>/dev/null | jq '. | length')
    LOW=$(gh api repos/jlaustill/c-next/issues?labels="priority:%20low" 2>/dev/null | jq '. | length')

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
if [ -d .git ]; then
    echo "📝 Recent Test Activity:"
    RECENT_TESTS=$(git log --since="7 days ago" --oneline --name-only | grep "tests/.*\.test\.cnx$" | sort -u | wc -l)
    echo "  New/modified tests (7d): $RECENT_TESTS"

    # Show last test commit
    LAST_TEST_COMMIT=$(git log --oneline --grep="test" -1 --format="%h %s" 2>/dev/null || echo "None")
    echo "  Last test commit:        $LAST_TEST_COMMIT"
    echo ""
fi

echo "🔥 Priority Actions:"
if [ "$SKIPPED" -gt 0 ]; then
    echo "  ⚠️  $SKIPPED tests blocked by bugs (Issues #7, #8)"
fi

if command -v gh &> /dev/null; then
    TEST_BLOCKED=$(gh api repos/jlaustill/c-next/issues?labels=test-blocked 2>/dev/null | jq '. | length')
    if [ "$TEST_BLOCKED" -gt 0 ]; then
        echo "  🔨 Fix $TEST_BLOCKED bug(s) to unblock tests"
    fi

    GOOD_FIRST=$(gh api repos/jlaustill/c-next/issues?labels="good%20first%20issue" 2>/dev/null | jq '. | length')
    if [ "$GOOD_FIRST" -gt 0 ]; then
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
