#!/usr/bin/env python3
"""
c-next pre-build script for PlatformIO
Compiles TypeScript build script and runs c-next transpilation
"""
print("🚀 build_cnext.py: Script starting...")

import subprocess
import sys
import os
import shutil
from pathlib import Path
import time

def run_command(cmd, shell=True):
    """Run a command and return the result"""
    try:
        result = subprocess.run(cmd, shell=shell, check=True, capture_output=True, text=True)
        return True, result.stdout, result.stderr
    except subprocess.CalledProcessError as e:
        return False, e.stdout, e.stderr

def check_if_transpilation_needed():
    """Check if any .cn or .cnm files are newer than the generated .cpp/.h files"""
    src_files = list(Path("src").glob("*.cn")) + list(Path("src").glob("*.cnm"))
    generated_files = list(Path("src").glob("*.cpp")) + list(Path("src").glob("*.h"))
    
    if not src_files:
        return False  # No c-next files to transpile
    
    if not generated_files:
        return True  # No generated files exist yet
    
    # Get the newest source file timestamp
    newest_src_time = max(f.stat().st_mtime for f in src_files)
    
    # Get the oldest generated file timestamp
    oldest_gen_time = min(f.stat().st_mtime for f in generated_files)
    
    # Transpile if any source file is newer than any generated file
    return newest_src_time > oldest_gen_time

def main():
    print("🚀 DEBUG: Script starting...")
    try:
        print("🚀 Starting c-next transpilation...")
        
        # For now, always transpile to ensure changes are picked up
        # TODO: Later we can optimize this to only transpile when needed
        print("📋 Force transpiling c-next files...")
        
        # Compile TypeScript build script
        print("📦 Compiling TypeScript build script...")
        success, stdout, stderr = run_command("npx tsc cnext-build.ts --target es2022 --module node16 --outDir .pio/build")
        
        if not success:
            print(f"❌ TypeScript compilation failed: {stderr}")
            sys.exit(1)
        
        # Run c-next transpilation
        print("🔄 Running c-next transpilation...")
        success, stdout, stderr = run_command("node .pio/build/cnext-build.js")
        
        if not success:
            print(f"❌ c-next transpilation failed: {stderr}")
            sys.exit(1)
        
        print(stdout)  # Show transpilation output
        
        # Copy generated C++ files to src directory so PlatformIO can find them
        generated_dir = Path("generated")
        src_dir = Path("src")
        
        if generated_dir.exists():
            print("📋 Copying generated C++ files to src directory...")
            for pattern in ["*.cpp", "*.h"]:
                for file_path in generated_dir.glob(pattern):
                    dest_path = src_dir / file_path.name
                    shutil.copy2(file_path, dest_path)
                    print(f"   Copied {file_path.name} to src/")
        
        print("✅ c-next transpilation completed!")
    except Exception as e:
        print(f"❌ ERROR: {e}")
        import traceback
        traceback.print_exc()

main()