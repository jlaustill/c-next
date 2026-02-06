#!/bin/bash
# PMD Copy-Paste Detector (CPD) wrapper script
# Requires Java 11+ and PMD to be installed
#
# Installation options:
# 1. Homebrew (macOS): brew install pmd
# 2. Manual: Download from https://pmd.github.io/ and add bin/ to PATH
# 3. SDKMAN: sdk install pmd

set -e

# Check if pmd is available
if ! command -v pmd &> /dev/null; then
    echo "PMD is not installed or not in PATH."
    echo ""
    echo "Installation options:"
    echo "  macOS:   brew install pmd"
    echo "  Linux:   Download from https://pmd.github.io/"
    echo "  Windows: Download from https://pmd.github.io/"
    echo "  SDKMAN:  sdk install pmd"
    echo ""
    echo "After installation, ensure 'pmd' is in your PATH."
    exit 1
fi

# Check Java version
if ! command -v java &> /dev/null; then
    echo "Java is not installed. PMD requires Java 11+."
    exit 1
fi

JAVA_VERSION=$(java -version 2>&1 | head -1 | cut -d'"' -f2 | cut -d'.' -f1)
if [ "$JAVA_VERSION" -lt 11 ]; then
    echo "PMD requires Java 11+. Current version: $JAVA_VERSION"
    exit 1
fi

echo "Running PMD Copy-Paste Detector on src/ and scripts/..."
echo ""

# Run CPD with TypeScript support
# --minimum-tokens: minimum token length for a duplicate (default 100)
# --language: target language (typescript requires tsconfig in PATH)
# --dir: directories to scan

pmd cpd \
    --minimum-tokens 50 \
    --language typescript \
    --dir src/ \
    --dir scripts/ \
    --skip-lexical-errors \
    --no-fail-on-violation \
    || true

echo ""
echo "CPD analysis complete."
