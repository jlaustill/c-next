#!/bin/bash
# Refresh Script - Sync main branch and rebuild everything
# Usage: ./scripts/refresh.sh

set -e

# Colors for output
BLUE='\033[0;34m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== C-Next Refresh ===${NC}"
echo ""

echo -e "${BLUE}[1/6]${NC} Checking out main branch..."
git checkout main

echo -e "${BLUE}[2/6]${NC} Pulling latest changes..."
git pull

echo -e "${BLUE}[3/6]${NC} Installing dependencies..."
npm i

echo -e "${BLUE}[4/6]${NC} Regenerating ANTLR parser..."
npm run antlr:all

echo -e "${BLUE}[5/6]${NC} Updating test expectations..."
npm run test:update

echo -e "${BLUE}[6/6]${NC} Running all tests..."
npm run test:all

echo ""
echo -e "${GREEN}=== Refresh complete! ===${NC}"
