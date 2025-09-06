#!/bin/bash

# Script to install the c-next VSCode extension

EXTENSION_PATH="$(dirname "$0")/../cnext-language-support-0.2.0.vsix"

echo "Installing c-next Language Support extension..."

# Check if VSCode is installed
if command -v code &> /dev/null; then
    echo "Installing extension for VSCode..."
    code --install-extension "$EXTENSION_PATH"
    echo "Extension installed successfully!"
    echo ""
    echo "To test the extension:"
    echo "1. Open VSCode"
    echo "2. Open the examples/blink/src/Blink.cn file"
    echo "3. You should see syntax highlighting and IntelliSense features"
    echo ""
    echo "Features available:"
    echo "- Syntax highlighting for .cn and .cnm files"
    echo "- Real-time error diagnostics"
    echo "- Auto-completion for c-next keywords and Arduino functions"
    echo "- Symbol detection and analysis"
    echo "- Hover information (planned)"
    echo "- Go-to-definition (planned)"
else
    echo "Error: VSCode (code command) not found in PATH"
    echo "Please install VSCode or ensure 'code' command is available"
    exit 1
fi