# c-next Development Scripts

This folder contains helpful scripts for c-next development workflow.

## VSCode Extension Installation

### Quick Install Script

For rapid development iteration of the VSCode extension:

**Linux/macOS:**
```bash
./scripts/install-vscode-extension.sh
```

**Windows:**
```batch
scripts\install-vscode-extension.bat
```

### What the script does:

1. 🗑️ **Removes** any existing c-next extension installation
2. 📋 **Copies** the latest extension files to VSCode extensions directory
3. ✅ **Reports** success and next steps

### Development Workflow:

1. **Edit** grammar files in `vscode-extension/`
2. **Run** the install script
3. **Reload** VSCode (`Ctrl+Shift+P` → "Developer: Reload Window")
4. **Test** with files in `vscode-extension/test-files/`
5. **Repeat** as needed!

### Extension Location:
- **Linux/macOS**: `~/.vscode/extensions/cnext-syntax-0.1.0/`
- **Windows**: `%USERPROFILE%\.vscode\extensions\cnext-syntax-0.1.0\`

## Other Scripts

More development scripts will be added here as the project grows:
- Build automation
- Testing helpers  
- Release packaging
- etc.