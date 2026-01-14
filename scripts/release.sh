#!/bin/bash
# C-Next Release Script
# Usage: ./scripts/release.sh <version>
# Example: ./scripts/release.sh 0.1.4

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "========================================"
echo "  C-Next Release Script"
echo "========================================"
echo ""

# Check if version argument provided
if [ -z "$1" ]; then
    echo -e "${RED}Error: Version argument required${NC}"
    echo "Usage: ./scripts/release.sh <version>"
    echo "Example: ./scripts/release.sh 0.1.4"
    exit 1
fi

VERSION="$1"

# Validate version format (semver without v prefix)
if ! [[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    echo -e "${RED}Error: Invalid version format '$VERSION'${NC}"
    echo "Version must be in format X.Y.Z (e.g., 0.1.4)"
    exit 1
fi

TAG="v$VERSION"

# Check we're on main branch
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "main" ]; then
    echo -e "${RED}Error: Must be on main branch (currently on '$CURRENT_BRANCH')${NC}"
    exit 1
fi

# Check working directory is clean
if [ -n "$(git status --porcelain)" ]; then
    echo -e "${RED}Error: Working directory is not clean${NC}"
    echo "Please commit or stash your changes first."
    git status --short
    exit 1
fi

# Check if tag already exists
if git rev-parse "$TAG" >/dev/null 2>&1; then
    echo -e "${RED}Error: Tag '$TAG' already exists${NC}"
    echo "If you need to recreate it, delete it first:"
    echo "  git tag -d $TAG && git push origin --delete $TAG"
    exit 1
fi

# Get current version from package.json
CURRENT_VERSION=$(grep '"version"' package.json | sed 's/.*"\([0-9.]*\)".*/\1/')
CURRENT_TAG="v$CURRENT_VERSION"
echo "Current version: $CURRENT_VERSION"
echo "New version:     $VERSION"
echo ""

# Pull latest changes
echo -e "${YELLOW}Pulling latest changes from origin/main...${NC}"
git pull origin main

# Regenerate parser (in case grammar changed)
echo ""
echo -e "${YELLOW}Regenerating parser from grammar...${NC}"
npm run antlr:all

# Run tests
echo ""
echo -e "${YELLOW}Running tests...${NC}"
npm test -- --quiet

# Run linter
echo ""
echo -e "${YELLOW}Running linter...${NC}"
npm run oxlint:check

echo ""
echo -e "${GREEN}All checks passed!${NC}"
echo ""

# Generate release notes
echo -e "${YELLOW}Generating release notes...${NC}"

# Get merged PRs since last tag
MERGED_PRS=$(git log "$CURRENT_TAG"..HEAD --oneline --merges | grep -oP '#\d+' | tr -d '#' | sort -u)

# Initialize categories
declare -a BUG_FIXES
declare -a FEATURES
declare -a TEST_COVERAGE
declare -a DOCUMENTATION
declare -a REFACTORING
declare -a OTHER

# Categorize each PR
for PR_NUM in $MERGED_PRS; do
    # Get PR info from GitHub
    PR_INFO=$(gh pr view "$PR_NUM" --json title,headRefName,body 2>/dev/null || echo "")

    if [ -z "$PR_INFO" ]; then
        continue
    fi

    PR_TITLE=$(echo "$PR_INFO" | jq -r '.title')
    PR_BRANCH=$(echo "$PR_INFO" | jq -r '.headRefName')
    PR_BODY=$(echo "$PR_INFO" | jq -r '.body')

    # Extract issue number if present (closes #X, fixes #X, etc.)
    ISSUE_REF=""
    if echo "$PR_TITLE $PR_BODY" | grep -qiE '(closes?|fixes?|resolves?)\s*#[0-9]+'; then
        ISSUE_NUM=$(echo "$PR_TITLE $PR_BODY" | grep -oiE '(closes?|fixes?|resolves?)\s*#[0-9]+' | head -1 | grep -oE '[0-9]+')
        if [ -n "$ISSUE_NUM" ]; then
            ISSUE_REF=", closes #$ISSUE_NUM"
        fi
    fi

    # Format the entry
    ENTRY="- $PR_TITLE (#$PR_NUM$ISSUE_REF)"

    # Categorize based on branch name prefix
    case "$PR_BRANCH" in
        fix/*|bugfix/*|hotfix/*)
            BUG_FIXES+=("$ENTRY")
            ;;
        feature/*|feat/*)
            # Check if it's actually a test coverage PR
            if echo "$PR_TITLE" | grep -qiE 'test|coverage'; then
                TEST_COVERAGE+=("$ENTRY")
            else
                FEATURES+=("$ENTRY")
            fi
            ;;
        test/*|tests/*)
            TEST_COVERAGE+=("$ENTRY")
            ;;
        docs/*|doc/*)
            DOCUMENTATION+=("$ENTRY")
            ;;
        refactor/*|chore/*)
            REFACTORING+=("$ENTRY")
            ;;
        *)
            # Try to categorize by title if branch name doesn't match
            if echo "$PR_TITLE" | grep -qiE '^fix|bug'; then
                BUG_FIXES+=("$ENTRY")
            elif echo "$PR_TITLE" | grep -qiE 'test|coverage'; then
                TEST_COVERAGE+=("$ENTRY")
            elif echo "$PR_TITLE" | grep -qiE '^doc|readme'; then
                DOCUMENTATION+=("$ENTRY")
            elif echo "$PR_TITLE" | grep -qiE 'refactor|migrate|chore'; then
                REFACTORING+=("$ENTRY")
            else
                OTHER+=("$ENTRY")
            fi
            ;;
    esac
done

# Create release notes file
NOTES_FILE=$(mktemp /tmp/release-notes-XXXXXX.md)

{
    if [ ${#BUG_FIXES[@]} -gt 0 ]; then
        echo "## Bug Fixes"
        echo ""
        printf '%s\n' "${BUG_FIXES[@]}"
        echo ""
    fi

    if [ ${#FEATURES[@]} -gt 0 ]; then
        echo "## Features & Improvements"
        echo ""
        printf '%s\n' "${FEATURES[@]}"
        echo ""
    fi

    if [ ${#TEST_COVERAGE[@]} -gt 0 ]; then
        echo "## Test Coverage"
        echo ""
        printf '%s\n' "${TEST_COVERAGE[@]}"
        echo ""
    fi

    if [ ${#REFACTORING[@]} -gt 0 ]; then
        echo "## Refactoring & Maintenance"
        echo ""
        printf '%s\n' "${REFACTORING[@]}"
        echo ""
    fi

    if [ ${#DOCUMENTATION[@]} -gt 0 ]; then
        echo "## Documentation"
        echo ""
        printf '%s\n' "${DOCUMENTATION[@]}"
        echo ""
    fi

    if [ ${#OTHER[@]} -gt 0 ]; then
        echo "## Other Changes"
        echo ""
        printf '%s\n' "${OTHER[@]}"
        echo ""
    fi
} > "$NOTES_FILE"

# Show generated notes
echo ""
echo -e "${BLUE}========================================"
echo "  Generated Release Notes"
echo "========================================${NC}"
cat "$NOTES_FILE"
echo -e "${BLUE}========================================${NC}"
echo ""

# Open in editor for review
EDITOR_CMD="${EDITOR:-${VISUAL:-nano}}"
echo -e "${YELLOW}Opening release notes in $EDITOR_CMD for review...${NC}"
echo "(Save and exit when done, or clear the file to cancel)"
read -p "Press Enter to open editor..." -r
$EDITOR_CMD "$NOTES_FILE"

# Check if file is empty (user cancelled)
if [ ! -s "$NOTES_FILE" ]; then
    echo -e "${RED}Release notes are empty. Release cancelled.${NC}"
    rm -f "$NOTES_FILE"
    exit 0
fi

# Show final notes and confirm
echo ""
echo -e "${BLUE}Final release notes:${NC}"
echo "----------------------------------------"
cat "$NOTES_FILE"
echo "----------------------------------------"
echo ""

# Confirm release
echo -e "${YELLOW}Ready to release $TAG${NC}"
read -p "Continue with release? (y/N) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Release cancelled."
    rm -f "$NOTES_FILE"
    exit 0
fi

# Update version in package.json
echo ""
echo -e "${YELLOW}Updating package.json version to $VERSION...${NC}"
sed -i "s/\"version\": \"$CURRENT_VERSION\"/\"version\": \"$VERSION\"/" package.json

# Commit version bump
echo -e "${YELLOW}Committing version bump...${NC}"
git add package.json
git commit -m "Bump version to $VERSION"

# Create tag
echo -e "${YELLOW}Creating tag $TAG...${NC}"
git tag "$TAG"

# Push commit and tag
echo -e "${YELLOW}Pushing to origin...${NC}"
git push origin main
git push origin "$TAG"

# Create GitHub release
echo ""
echo -e "${YELLOW}Creating GitHub release...${NC}"
gh release create "$TAG" --title "$TAG" --notes-file "$NOTES_FILE"

# Cleanup
rm -f "$NOTES_FILE"

echo ""
echo -e "${GREEN}========================================"
echo "  Release $TAG complete!"
echo "========================================${NC}"
echo ""
echo "Next steps:"
echo "  1. Check the publish workflow: https://github.com/jlaustill/c-next/actions"
echo "  2. Verify npm package: https://www.npmjs.com/package/c-next"
