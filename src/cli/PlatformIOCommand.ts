/**
 * PlatformIOCommand
 * Setup and uninstall PlatformIO integration
 */

import { resolve } from "node:path";
import NodeFileSystem from "../cnx/PARSE/1-Discover/NodeFileSystem";
import Write from "../cnx/WRITE/1-Write/Write";
import IFileConfig from "./types/IFileConfig";
import CONFIG_FILE_NAMES from "../cnx/types/CONFIG_FILE_NAMES";
import type IFileSystem from "../cnx/types/IFileSystem";
import ConfigLoader from "./ConfigLoader";
import ResultPrinter from "./ResultPrinter";
import type TConfigObject from "./types/TConfigObject";

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
function getPioProjectPaths(fs: IFileSystem): IPioProjectPaths {
  const pioIniPath = resolve(process.cwd(), "platformio.ini");
  const scriptPath = resolve(process.cwd(), "cnext_build.py");

  if (!fs.exists(pioIniPath)) {
    console.error("Error: platformio.ini not found in current directory");
    console.error("Run this command from your PlatformIO project root");
    process.exit(1);
  }

  return { pioIniPath, scriptPath };
}

/** The pre-build script entry cnext writes into platformio.ini. */
const CNEXT_BUILD_SCRIPT = "pre:cnext_build.py";

/**
 * Remove every occurrence of `entry` together with the whitespace run
 * immediately before it.
 *
 * Replaces /[\n\t ]+pre:cnext_build\.py/g, which retries the whitespace run
 * from each of its positions and is super-linear on a long run (S8786).
 *
 * An occurrence with no whitespace before it is left in place, matching the
 * `+` in the original -- that form is handled by the standalone-line replace
 * above.
 */
function removeEntryWithLeadingWhitespace(text: string, entry: string): string {
  const isIndent = (character: string): boolean =>
    character === "\n" || character === "\t" || character === " ";

  let result = "";
  let cursor = 0;
  for (;;) {
    const at = text.indexOf(entry, cursor);
    if (at === -1) {
      return result + text.slice(cursor);
    }

    let start = at;
    while (start > cursor && isIndent(text[start - 1])) {
      start -= 1;
    }

    result +=
      start === at
        ? text.slice(cursor, at + entry.length) // no leading whitespace: keep it
        : text.slice(cursor, start);
    cursor = at + entry.length;
  }
}

/**
 * PlatformIO integration commands
 */
class PlatformIOCommand {
  /**
   * Setup PlatformIO integration
   * Creates cnext_build.py and modifies platformio.ini
   *
   * #2165: a config under an old name stops it with E0918 before anything is
   * written. Writing a new-name config beside the old one would leave the
   * project failing every run on the pair. So does a config it cannot read or
   * that holds no config object (#2221 review): it used to write on, dropping
   * the settings or shadowing the file.
   */
  static install(fs: IFileSystem = NodeFileSystem.instance): void {
    const { pioIniPath, scriptPath } = getPioProjectPaths(fs);
    const config = ConfigLoader.inDirectory(process.cwd(), fs);
    if (config.kind === "renamed") {
      for (const error of config.errors) {
        ResultPrinter.printError(error);
      }
      process.exit(1);
    }
    // #2221 review: a config it cannot read was only a warning, so install
    // wrote on: a crash half-installed, or a cnx.config.json shadowing it
    if (config.unreadable.length > 0) {
      PlatformIOCommand.stopBeforeWriting(
        config.unreadable.map((file) => file.reason),
      );
    }
    const existing: TConfigObject =
      config.kind === "found"
        ? ConfigLoader.objectOf(config)
        : { kind: "object", config: {} };
    if (existing.kind === "invalid") {
      PlatformIOCommand.stopBeforeWriting([existing.reason]);
    }
    const configPath =
      config.kind === "found"
        ? config.path
        : resolve(process.cwd(), CONFIG_FILE_NAMES[0]);

    // Create cnext_build.py script
    // Issue #833: Run transpilation at import time (before compilation),
    // not as a pre-action on buildprog (which runs after compilation)
    const buildScript = String.raw`Import("env")
import subprocess
import sys
from pathlib import Path

def transpile_cnext():
    """Transpile from main.cnx entry point — cnext follows includes"""
    entry = Path("src/main.cnx")
    if not entry.exists():
        return

    print("Transpiling from main.cnx...")

    try:
        # ADR-049: the environment being built names the target. Without it,
        # "pio run -e X" in a project whose default_envs names Y would get Y's.
        result = subprocess.run(
            ["cnext", str(entry), "--pio-env", env["PIOENV"]],
            check=True,
            capture_output=True,
            text=True
        )
        # Warnings go to stderr, which a successful run would otherwise drop
        if result.stderr:
            print(result.stderr.rstrip())
        if result.stdout:
            lines = result.stdout.strip().split("\n")
            for line in lines:
                if line.startswith(("Compiled", "Target", "Collected", "Generated")):
                    print(f"  {line}")
        print("  ✓ Transpilation complete")
    except subprocess.CalledProcessError as e:
        print(f"  ✗ Transpilation failed")
        print(e.stderr)
        sys.exit(1)

# Run transpilation at import time (before compilation starts)
transpile_cnext()
`;

    Write.file(fs, scriptPath, buildScript);
    console.log(`✓ Created: ${scriptPath}`);

    // Read platformio.ini
    const pioIni = fs.readFile(pioIniPath);

    // An already-configured platformio.ini is left as it is; the config is
    // set up either way (#2221 review: a reinstall used to return first)
    const alreadyConfigured = pioIni.includes("cnext_build.py");
    if (alreadyConfigured) {
      console.log("✓ PlatformIO already configured for c-next");
    } else {
      Write.file(fs, pioIniPath, PlatformIOCommand.withBuildScript(pioIni));
      console.log(`✓ Modified: ${pioIniPath}`);
    }

    this.setupConfig(configPath, existing.config, fs);
    if (alreadyConfigured) {
      return;
    }

    console.log("");
    console.log("✓ PlatformIO integration configured!");
    console.log("");
    console.log("Next steps:");
    console.log("  1. Create src/main.cnx as your entry point");
    console.log("  2. Use #include to pull in other .cnx files");
    console.log("  3. Run: pio run");
    console.log("");
    console.log(
      "The transpiler will follow includes from main.cnx automatically.",
    );
    console.log("Commit both .cnx and generated .c files to version control.");
  }

  /**
   * Stop before anything is written, with each reason the project's config
   * cannot be used: the one way install refuses a config (#2221 review).
   */
  private static stopBeforeWriting(reasons: readonly string[]): never {
    for (const reason of reasons) {
      console.error(
        `Error: ${reason}; nothing was written. Fix it and run --pio-install again.`,
      );
    }
    process.exit(1);
  }

  /** `pioIni` with the pre-build script in its `extra_scripts`. */
  private static withBuildScript(pioIni: string): string {
    if (pioIni.includes("extra_scripts")) {
      // Append to existing extra_scripts
      return pioIni.replace(
        /extra_scripts\s*=\s*(.+)/,
        "extra_scripts = $1\n    pre:cnext_build.py",
      );
    }
    // Add new extra_scripts line after first [env:*] section
    return pioIni.replace(
      /(\[env:[^\]]+\])/,
      "$1\nextra_scripts = pre:cnext_build.py",
    );
  }

  /**
   * Give the project's config PlatformIO-appropriate defaults
   * - Appends .pio/libdeps to include array
   * - Sets headerOut to "include" if not already set
   *
   * #2165: the file updated is this directory's config, under whichever name
   * it has. Writing `cnx.config.json` regardless shadowed a project's `.cnxrc`,
   * silently, since the walk takes the first name. An ancestor's config is
   * never this project's to shadow: `platformio.ini` makes this directory its
   * own root (#2261, which closed #2235).
   */
  private static setupConfig(
    configPath: string,
    config: IFileConfig,
    fs: IFileSystem,
  ): void {
    const pioInclude = ".pio/libdeps";
    const includes = config.include ?? [];
    const hasPioInclude = includes.includes(pioInclude);
    // A reinstall of a project already set up writes nothing (#2221 review)
    if (hasPioInclude && config.headerOut) {
      console.log(`✓ ${configPath} already has the PlatformIO defaults`);
      return;
    }

    const updated: IFileConfig = {
      ...config,
      // Append .pio/libdeps to include array if not already present
      include: hasPioInclude ? includes : [...includes, pioInclude],
      // Set headerOut only if not already set
      headerOut: config.headerOut || "include",
    };

    // Write config (with pretty formatting)
    Write.file(fs, configPath, JSON.stringify(updated, null, 2) + "\n");
    console.log(`✓ Updated: ${configPath}`);
  }

  /**
   * Remove PlatformIO integration
   * Deletes cnext_build.py and removes extra_scripts from platformio.ini
   */
  static uninstall(fs: IFileSystem = NodeFileSystem.instance): void {
    const { pioIniPath, scriptPath } = getPioProjectPaths(fs);

    let hasChanges = false;

    // Remove cnext_build.py if it exists
    if (fs.exists(scriptPath)) {
      try {
        Write.remove(fs, scriptPath);
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
    let pioIni = fs.readFile(pioIniPath);

    // Check if extra_scripts includes cnext_build.py
    if (pioIni.includes("cnext_build.py")) {
      // Remove the cnext_build.py reference
      // Handle both standalone and appended cases
      // Remove standalone "extra_scripts = pre:cnext_build.py" line (with newline)
      pioIni = pioIni.replace(
        /^extra_scripts[ \t]*=[ \t]*pre:cnext_build\.py[ \t]*\n/m,
        "",
      );
      // Remove from multi-line extra_scripts (e.g., "    pre:cnext_build.py")
      pioIni = removeEntryWithLeadingWhitespace(pioIni, CNEXT_BUILD_SCRIPT);
      // Clean up multiple consecutive blank lines
      pioIni = pioIni.replaceAll(/\n\n\n+/g, "\n\n");

      Write.file(fs, pioIniPath, pioIni);
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
      console.log("To re-enable integration: cnx --pio-install");
    } else {
      console.log("");
      console.log("No c-next integration found - nothing to remove.");
    }
  }
}

export default PlatformIOCommand;
