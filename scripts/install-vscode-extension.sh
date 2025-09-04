#!/bin/bash

# c-next VSCode Extension Quick Install Script
# Copies the extension to VSCode extensions directory for rapid iteration

set -e  # Exit on any error

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
EXTENSION_DIR="$PROJECT_ROOT/vscode-extension"
EXTENSION_NAME="cnext-syntax-0.1.0"

# Detect VSCode extensions directory
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    VSCODE_EXT_DIR="$HOME/.vscode/extensions"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux
    VSCODE_EXT_DIR="$HOME/.vscode/extensions"
elif [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" ]]; then
    # Windows (Git Bash/Cygwin)
    VSCODE_EXT_DIR="$USERPROFILE/.vscode/extensions"
else
    echo "❌ Unsupported OS: $OSTYPE"
    exit 1
fi

TARGET_DIR="$VSCODE_EXT_DIR/$EXTENSION_NAME"

echo "🚀 Installing c-next VSCode Extension..."
echo "📁 Source: $EXTENSION_DIR"
echo "📁 Target: $TARGET_DIR"

# Check if source directory exists
if [ ! -d "$EXTENSION_DIR" ]; then
    echo "❌ Extension source directory not found: $EXTENSION_DIR"
    exit 1
fi

# Check if VSCode extensions directory exists
if [ ! -d "$VSCODE_EXT_DIR" ]; then
    echo "❌ VSCode extensions directory not found: $VSCODE_EXT_DIR"
    echo "💡 Make sure VSCode is installed and has been run at least once"
    exit 1
fi

# Remove existing installation if it exists
if [ -d "$TARGET_DIR" ]; then
    echo "🗑️  Removing existing installation..."
    rm -rf "$TARGET_DIR"
fi

# Build and install extension using VSIX
echo "📦 Building extension package..."
cd "$EXTENSION_DIR"
npx @vscode/vsce package --out cnext-syntax.vsix > /dev/null 2>&1

if [ ! -f "cnext-syntax.vsix" ]; then
    echo "❌ Failed to build extension package"
    exit 1
fi

echo "📥 Installing extension..."
code --install-extension cnext-syntax.vsix

if [ $? -eq 0 ]; then
    echo "✅ Extension installed successfully!"
    echo ""
    echo "📝 Next steps:"
    echo "   1. Restart VSCode (Ctrl+Shift+P → 'Developer: Reload Window')"
    echo "   2. Open a .cn or .cnm file to test syntax highlighting"
    echo "   3. Check example projects in: $PROJECT_ROOT/vscode-extension/examples/"
    echo ""
    echo "🔍 Extension now appears as: jlaustill.cnext-syntax"
    echo "🔄 To update the extension, just run this script again!"
    
    # Clean up
    rm -f cnext-syntax.vsix
else
    echo "❌ Failed to install extension"
    exit 1
fi