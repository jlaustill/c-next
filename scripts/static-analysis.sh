#!/bin/bash
# Static Analysis Script for C-Next Generated Code
# Transpiles examples and runs static analyzers on the output

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
TEMP_DIR="${PROJECT_ROOT}/analysis-temp"
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

# Generate parser files if needed
if [ ! -d "${PROJECT_ROOT}/src/parser" ]; then
    echo -e "${YELLOW}Generating parser files...${NC}"
    cd "$PROJECT_ROOT" && npm run antlr:all
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

    if "${PROJECT_ROOT}/bin/cnext.js" "$cnx_file" -o "$c_file" >/dev/null 2>&1; then
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

# Run flawfinder if available (CWE-based security scanner)
if command -v flawfinder &> /dev/null; then
    echo -e "${BLUE}Running flawfinder (CWE security scanner)...${NC}"
    echo ""

    # Run flawfinder with --minlevel=1 to show all actionable findings
    set +e  # Temporarily disable exit on error
    FLAWFINDER_OUTPUT=$(flawfinder --minlevel=1 --dataonly "$TEMP_DIR" 2>&1)
    set -e

    # Count findings by risk level (flawfinder uses levels 0-5)
    count_level() {
        local level=$1
        local count
        count=$(echo "$FLAWFINDER_OUTPUT" | grep -c "\[${level}\]" 2>/dev/null) || count=0
        echo "$count"
    }

    LEVEL_5=$(count_level 5)
    LEVEL_4=$(count_level 4)
    LEVEL_3=$(count_level 3)
    LEVEL_2=$(count_level 2)
    LEVEL_1=$(count_level 1)

    echo -e "${BLUE}=== flawfinder Results ===${NC}"
    echo ""

    if [ -n "$FLAWFINDER_OUTPUT" ]; then
        echo "$FLAWFINDER_OUTPUT"
        echo ""
    fi

    echo -e "${BLUE}Summary (by risk level):${NC}"
    echo -e "  Level 5 (critical):  ${RED}${LEVEL_5}${NC}"
    echo -e "  Level 4 (high):      ${RED}${LEVEL_4}${NC}"
    echo -e "  Level 3 (medium):    ${YELLOW}${LEVEL_3}${NC}"
    echo -e "  Level 2 (low):       ${LEVEL_2}"
    echo -e "  Level 1 (info):      ${LEVEL_1}"
    echo ""

    TOTAL_FLAWFINDER=$((LEVEL_5 + LEVEL_4 + LEVEL_3 + LEVEL_2 + LEVEL_1))
    if [ "$TOTAL_FLAWFINDER" -eq 0 ]; then
        echo -e "${GREEN}No security issues found!${NC}"
    else
        echo -e "${YELLOW}Total security findings: ${TOTAL_FLAWFINDER}${NC}"
    fi
    echo ""
else
    echo -e "${YELLOW}flawfinder not installed. Install with: pip install flawfinder${NC}"
    echo ""
fi

echo -e "${BLUE}Generated files are in: ${TEMP_DIR}${NC}"
echo ""

# Exit with error if there are actual errors
if [ "$ERRORS" -gt 0 ]; then
    exit 1
fi

exit 0
