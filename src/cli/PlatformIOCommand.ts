/**
 * PlatformIOCommand
 * Setup and uninstall PlatformIO integration
 */

import { resolve } from "node:path";
import { existsSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import IFileConfig from "./types/IFileConfig";

/**
 * Resolved paths for PlatformIO project.
 */
interface IPioProjectPaths {
  pioIniPath: string;
  scriptPath: string;
}

/**
 * Get PlatformIO project paths and validate that platformio.ini exists.
 * Exits with error if not in a PlatformIO project directory.
 */
function getPioProjectPaths(): IPioProjectPaths {
  const pioIniPath = resolve(process.cwd(), "platformio.ini");
  const scriptPath = resolve(process.cwd(), "cnext_build.py");

  if (!existsSync(pioIniPath)) {
    console.error("Error: platformio.ini not found in current directory");
    console.error("Run this command from your PlatformIO project root");
    process.exit(1);
  }

  return { pioIniPath, scriptPath };
}

/**
 * PlatformIO integration commands
 */
class PlatformIOCommand {
  /**
   * Setup PlatformIO integration
   * Creates cnext_build.py and modifies platformio.ini
   */
  static install(): void {
    const { pioIniPath, scriptPath } = getPioProjectPaths();

    // Create cnext_build.py script
    const buildScript = `Import("env")
import subprocess
from pathlib import Path

def transpile_cnext(source, target, env):
    """Transpile all .cnx files before build"""
    # Find all .cnx files in src directory
    src_dir = Path("src")
    if not src_dir.exists():
        return

    cnx_files = list(src_dir.rglob("*.cnx"))
    if not cnx_files:
        return

    print(f"Transpiling {len(cnx_files)} c-next files...")

    for cnx_file in cnx_files:
        try:
            result = subprocess.run(
                ["cnext", str(cnx_file)],
                check=True,
                capture_output=True,
                text=True
            )
            print(f"  ✓ {cnx_file.name}")
        except subprocess.CalledProcessError as e:
            print(f"  ✗ Error: {cnx_file.name}")
            print(e.stderr)
            env.Exit(1)

env.AddPreAction("buildprog", transpile_cnext)
`;

    writeFileSync(scriptPath, buildScript, "utf-8");
    console.log(`✓ Created: ${scriptPath}`);

    // Read platformio.ini
    let pioIni = readFileSync(pioIniPath, "utf-8");

    // Check if extra_scripts is already present
    if (pioIni.includes("cnext_build.py")) {
      console.log("✓ PlatformIO already configured for c-next");
      return;
    }

    // Add extra_scripts line to [env:*] section or create it
    if (pioIni.includes("extra_scripts")) {
      // Append to existing extra_scripts
      pioIni = pioIni.replace(
        /extra_scripts\s*=\s*(.+)/,
        "extra_scripts = $1\n    pre:cnext_build.py",
      );
    } else {
      // Add new extra_scripts line after first [env:*] section
      pioIni = pioIni.replace(
        /(\[env:[^\]]+\])/,
        "$1\nextra_scripts = pre:cnext_build.py",
      );
    }

    writeFileSync(pioIniPath, pioIni, "utf-8");
    console.log(`✓ Modified: ${pioIniPath}`);

    // Setup cnext.config.json for PlatformIO
    this.setupConfig();

    console.log("");
    console.log("✓ PlatformIO integration configured!");
    console.log("");
    console.log("Next steps:");
    console.log(
      "  1. Create .cnx files in src/ (alongside your .c/.cpp files)",
    );
    console.log("  2. Run: pio run");
    console.log("");
    console.log(
      "The transpiler will automatically convert .cnx → .c before each build.",
    );
    console.log("Commit both .cnx and generated .c files to version control.");
  }

  /**
   * Setup cnext.config.json with PlatformIO-appropriate defaults
   * - Appends .pio/libdeps to include array
   * - Sets headerOut to "include" if not already set
   */
  private static setupConfig(): void {
    const configPath = resolve(process.cwd(), "cnext.config.json");
    const pioInclude = ".pio/libdeps";

    let config: IFileConfig = {};

    if (existsSync(configPath)) {
      try {
        const content = readFileSync(configPath, "utf-8");
        config = JSON.parse(content) as IFileConfig;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.log(
          `⚠ Could not parse existing cnext.config.json (${msg}), creating new one`,
        );
        config = {};
      }
    }

    // Append .pio/libdeps to include array if not already present
    const includes = config.include ?? [];
    if (!includes.includes(pioInclude)) {
      config.include = [...includes, pioInclude];
    }

    // Set headerOut only if not already set
    if (!config.headerOut) {
      config.headerOut = "include";
    }

    // Write config (with pretty formatting)
    writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n", "utf-8");
    console.log(`✓ Updated: ${configPath}`);
  }

  /**
   * Remove PlatformIO integration
   * Deletes cnext_build.py and removes extra_scripts from platformio.ini
   */
  static uninstall(): void {
    const { pioIniPath, scriptPath } = getPioProjectPaths();

    let hasChanges = false;

    // Remove cnext_build.py if it exists
    if (existsSync(scriptPath)) {
      try {
        unlinkSync(scriptPath);
        console.log(`✓ Removed: ${scriptPath}`);
        hasChanges = true;
      } catch (err) {
        console.error(`Error removing ${scriptPath}:`, err);
        process.exit(1);
      }
    } else {
      console.log("✓ cnext_build.py not found (already removed)");
    }

    // Read platformio.ini
    let pioIni = readFileSync(pioIniPath, "utf-8");

    // Check if extra_scripts includes cnext_build.py
    if (pioIni.includes("cnext_build.py")) {
      // Remove the cnext_build.py reference
      // Handle both standalone and appended cases
      pioIni = pioIni
        // Remove standalone "extra_scripts = pre:cnext_build.py" line (with newline)
        .replace(/^extra_scripts[ \t]*=[ \t]*pre:cnext_build\.py[ \t]*\n/m, "")
        // Remove from multi-line extra_scripts (e.g., "    pre:cnext_build.py")
        // Use explicit whitespace chars to avoid backtracking with \s+
        .replaceAll(/[\n\t ]+pre:cnext_build\.py/g, "")
        // Clean up multiple consecutive blank lines
        .replaceAll(/\n\n\n+/g, "\n\n");

      writeFileSync(pioIniPath, pioIni, "utf-8");
      console.log(`✓ Modified: ${pioIniPath}`);
      hasChanges = true;
    } else {
      console.log(
        "✓ platformio.ini already clean (no c-next integration found)",
      );
    }

    if (hasChanges) {
      console.log("");
      console.log("✓ PlatformIO integration removed!");
      console.log("");
      console.log("Your .cnx files remain untouched.");
      console.log("To re-enable integration: cnext --pio-install");
    } else {
      console.log("");
      console.log("No c-next integration found - nothing to remove.");
    }
  }
}

export default PlatformIOCommand;
