@echo off
REM c-next VSCode Extension Quick Install Script (Windows)
REM Copies the extension to VSCode extensions directory for rapid iteration

setlocal enabledelayedexpansion

echo 🚀 Installing c-next VSCode Extension...

REM Get script directory and project root
set SCRIPT_DIR=%~dp0
set PROJECT_ROOT=%SCRIPT_DIR%..
set EXTENSION_DIR=%PROJECT_ROOT%\vscode-extension
set EXTENSION_NAME=cnext-syntax-0.1.0

REM VSCode extensions directory
set VSCODE_EXT_DIR=%USERPROFILE%\.vscode\extensions
set TARGET_DIR=%VSCODE_EXT_DIR%\%EXTENSION_NAME%

echo 📁 Source: %EXTENSION_DIR%
echo 📁 Target: %TARGET_DIR%

REM Check if source directory exists
if not exist "%EXTENSION_DIR%" (
    echo ❌ Extension source directory not found: %EXTENSION_DIR%
    pause
    exit /b 1
)

REM Check if VSCode extensions directory exists
if not exist "%VSCODE_EXT_DIR%" (
    echo ❌ VSCode extensions directory not found: %VSCODE_EXT_DIR%
    echo 💡 Make sure VSCode is installed and has been run at least once
    pause
    exit /b 1
)

REM Remove existing installation if it exists
if exist "%TARGET_DIR%" (
    echo 🗑️  Removing existing installation...
    rmdir /s /q "%TARGET_DIR%"
)

REM Copy extension files
echo 📋 Copying extension files...
xcopy "%EXTENSION_DIR%" "%TARGET_DIR%" /e /i /y >nul

echo ✅ Extension installed successfully!
echo.
echo 📝 Next steps:
echo    1. Restart VSCode (Ctrl+Shift+P → 'Developer: Reload Window')
echo    2. Open a .cn or .cnm file to test syntax highlighting
echo    3. Check test files in: %PROJECT_ROOT%\vscode-extension\test-files\
echo.
echo 🔄 To update the extension, just run this script again!

pause