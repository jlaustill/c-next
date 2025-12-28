#!/bin/bash
# Static Analysis Script for C-Next Generated Code
# Transpiles examples and runs static analyzers on the output

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
TEMP_DIR="${PROJECT_ROOT}/.analysis-temp"
TOOLS_DIR="${PROJECT_ROOT}/tools"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== C-Next Static Analysis ===${NC}"
echo ""

# Create temp directory for generated C files
rm -rf "$TEMP_DIR"
mkdir -p "$TEMP_DIR"

# Check for cppcheck
if ! command -v cppcheck &> /dev/null; then
    echo -e "${RED}Error: cppcheck not found. Install with: sudo apt install cppcheck${NC}"
    exit 1
fi

echo -e "${BLUE}cppcheck version:${NC} $(cppcheck --version)"
echo ""

# Build the transpiler if needed
if [ ! -f "${PROJECT_ROOT}/dist/index.js" ]; then
    echo -e "${YELLOW}Building transpiler...${NC}"
    cd "$PROJECT_ROOT" && npm run build
fi

# Find all .cnx example files
EXAMPLES=$(find "${PROJECT_ROOT}/examples" -name "*.cnx" -type f)
TOTAL_FILES=$(echo "$EXAMPLES" | wc -l)
TRANSPILED=0
FAILED=0

echo -e "${BLUE}Transpiling ${TOTAL_FILES} example files...${NC}"
echo ""

# Transpile each example
for cnx_file in $EXAMPLES; do
    filename=$(basename "$cnx_file" .cnx)
    c_file="${TEMP_DIR}/${filename}.c"

    echo -n "  Transpiling ${filename}.cnx... "

    if node "${PROJECT_ROOT}/dist/index.js" "$cnx_file" -o "$c_file" >/dev/null 2>&1; then
        echo -e "${GREEN}OK${NC}"
        TRANSPILED=$((TRANSPILED + 1))
    else
        echo -e "${RED}FAILED${NC}"
        FAILED=$((FAILED + 1))
    fi
done

echo ""
echo -e "${BLUE}Transpiled: ${TRANSPILED}/${TOTAL_FILES}${NC}"

if [ "$TRANSPILED" -eq 0 ]; then
    echo -e "${RED}No files to analyze.${NC}"
    exit 1
fi

echo ""
echo -e "${BLUE}Running cppcheck...${NC}"
echo ""

# Run cppcheck on all generated files
CPPCHECK_ARGS=(
    "--enable=all"
    "--std=c99"
    "--force"
    "--inline-suppr"
    "--error-exitcode=0"
)

# Add suppressions file if it exists
if [ -f "${TOOLS_DIR}/cppcheck-suppressions.txt" ]; then
    CPPCHECK_ARGS+=("--suppressions-list=${TOOLS_DIR}/cppcheck-suppressions.txt")
fi

# Run cppcheck and capture output
set +e  # Temporarily disable exit on error for cppcheck
CPPCHECK_OUTPUT=$(cppcheck "${CPPCHECK_ARGS[@]}" "$TEMP_DIR" 2>&1)
CPPCHECK_EXIT=$?
set -e  # Re-enable exit on error

# Count warnings and errors
count_matches() {
    local pattern=$1
    local count
    count=$(echo "$CPPCHECK_OUTPUT" | grep -c "$pattern" 2>/dev/null) || count=0
    echo "$count"
}

ERRORS=$(count_matches "error:")
WARNINGS=$(count_matches "warning:")
STYLE=$(count_matches "style:")
PERFORMANCE=$(count_matches "performance:")
PORTABILITY=$(count_matches "portability:")
INFORMATION=$(count_matches "information:")

# Display results
echo -e "${BLUE}=== cppcheck Results ===${NC}"
echo ""

if [ -n "$CPPCHECK_OUTPUT" ]; then
    echo "$CPPCHECK_OUTPUT"
    echo ""
fi

echo -e "${BLUE}Summary:${NC}"
echo -e "  Errors:      ${RED}${ERRORS}${NC}"
echo -e "  Warnings:    ${YELLOW}${WARNINGS}${NC}"
echo -e "  Style:       ${STYLE}"
echo -e "  Performance: ${PERFORMANCE}"
echo -e "  Portability: ${PORTABILITY}"
echo -e "  Information: ${INFORMATION}"
echo ""

TOTAL_ISSUES=$((ERRORS + WARNINGS + STYLE + PERFORMANCE + PORTABILITY))

if [ "$TOTAL_ISSUES" -eq 0 ]; then
    echo -e "${GREEN}No issues found!${NC}"
else
    echo -e "${YELLOW}Total issues: ${TOTAL_ISSUES}${NC}"
fi

echo ""
echo -e "${BLUE}Generated files are in: ${TEMP_DIR}${NC}"
echo ""

# Exit with error if there are actual errors
if [ "$ERRORS" -gt 0 ]; then
    exit 1
fi

exit 0
