#!/bin/bash
# C-Next Release Script
# Usage: ./scripts/release.sh <version>
# Example: ./scripts/release.sh 0.1.4

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
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
echo "Current version: $CURRENT_VERSION"
echo "New version:     $VERSION"
echo ""

# Pull latest changes
echo -e "${YELLOW}Pulling latest changes from origin/main...${NC}"
git pull origin main

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

# Show what will be released
echo "========================================"
echo "  Changes since v$CURRENT_VERSION"
echo "========================================"
git log "v$CURRENT_VERSION"..HEAD --oneline --merges | head -20
echo ""

# Confirm release
echo -e "${YELLOW}Ready to release $TAG${NC}"
read -p "Continue? (y/N) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Release cancelled."
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
echo "Enter release notes (press Ctrl+D when done):"
echo "---"
NOTES=$(cat)

gh release create "$TAG" --title "$TAG" --notes "$NOTES"

echo ""
echo -e "${GREEN}========================================"
echo "  Release $TAG complete!"
echo "========================================${NC}"
echo ""
echo "Next steps:"
echo "  1. Check the publish workflow: https://github.com/jlaustill/c-next/actions"
echo "  2. Verify npm package: https://www.npmjs.com/package/c-next"
