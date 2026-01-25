/**
 * PlatformIO Configuration Detector
 * ADR-049: Auto-detect target platform from platformio.ini
 */

import { existsSync, readFileSync } from "fs";
import { dirname, resolve } from "path";

/**
 * PlatformIO board to C-Next target mapping
 * Maps common board names to their Cortex-M core types
 */
const BOARD_TO_TARGET: Record<string, string> = {
  // Teensy boards (NXP i.MX RT)
  teensy41: "teensy41",
  teensy40: "teensy40",
  teensy36: "cortex-m4", // Kinetis K66
  teensy35: "cortex-m4", // Kinetis K64
  teensy32: "cortex-m4", // Kinetis MK20
  teensy31: "cortex-m4", // Kinetis MK20
  teensylc: "cortex-m0+", // Kinetis KL26

  // STM32 F7 series (Cortex-M7)
  nucleo_f767zi: "cortex-m7",
  disco_f769ni: "cortex-m7",

  // STM32 F4 series (Cortex-M4)
  nucleo_f446re: "cortex-m4",
  disco_f407vg: "cortex-m4",
  black_f407ve: "cortex-m4",

  // STM32 F3 series (Cortex-M4)
  nucleo_f303re: "cortex-m4",

  // STM32 F1 series (Cortex-M3)
  bluepill_f103c8: "cortex-m3",
  nucleo_f103rb: "cortex-m3",

  // STM32 F0/L0 series (Cortex-M0)
  nucleo_f030r8: "cortex-m0",
  nucleo_l011k4: "cortex-m0+",

  // Arduino boards (AVR)
  uno: "avr",
  mega: "avr",
  nano: "avr",
  leonardo: "avr",

  // Arduino ARM boards
  due: "cortex-m3", // SAM3X8E
  zero: "cortex-m0+", // SAMD21
  mkrzero: "cortex-m0+", // SAMD21

  // ESP32 (Xtensa - no LDREX/STREX)
  esp32dev: "esp32",
  esp32: "esp32",

  // RP2040 (Cortex-M0+)
  pico: "cortex-m0+",
  rpipico: "cortex-m0+",
};

/**
 * Parse a platformio.ini file and extract configuration
 */
function parsePlatformIOConfig(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  let currentSection = "";

  for (const line of content.split("\n")) {
    const trimmed = line.trim();

    // Skip comments and empty lines
    if (trimmed.startsWith(";") || trimmed.startsWith("#") || !trimmed) {
      continue;
    }

    // Section header
    const sectionMatch = /^\[([^\]]+)\]$/.exec(trimmed);
    if (sectionMatch) {
      currentSection = sectionMatch[1];
      continue;
    }

    // Key = value pair
    const kvMatch = /^(\w+)\s*=\s*(.+)$/.exec(trimmed);
    if (kvMatch && currentSection) {
      const key = `${currentSection}.${kvMatch[1]}`;
      result[key] = kvMatch[2].trim();
    }
  }

  return result;
}

/**
 * Search for platformio.ini starting from a directory and going up
 */
function findPlatformIOConfig(startDir: string): string | null {
  let dir = resolve(startDir);

  while (dir !== dirname(dir)) {
    const configPath = resolve(dir, "platformio.ini");
    if (existsSync(configPath)) {
      return configPath;
    }
    dir = dirname(dir);
  }

  return null;
}

/**
 * Detect target platform from platformio.ini
 *
 * @param startDir - Directory to start searching from (usually input file's directory)
 * @returns Target name if detected, undefined otherwise
 *
 * @example
 * ```typescript
 * const target = detectPlatformIOTarget('/home/user/project/src');
 * // Returns "teensy41" if platformio.ini has board = teensy41
 * ```
 */
function detectPlatformIOTarget(startDir: string): string | undefined {
  const configPath = findPlatformIOConfig(startDir);
  if (!configPath) {
    return undefined;
  }

  try {
    const content = readFileSync(configPath, "utf-8");
    const config = parsePlatformIOConfig(content);

    // Check for board in [env] or [env:*] sections
    // Priority: [env:default] > [env] > first [env:*]
    const envDefault = config["env:default.board"];
    const env = config["env.board"];

    // Find first env:* board if no default
    let firstEnvBoard: string | undefined;
    for (const key of Object.keys(config)) {
      if (key.startsWith("env:") && key.endsWith(".board")) {
        firstEnvBoard = config[key];
        break;
      }
    }

    const board = envDefault || env || firstEnvBoard;
    if (!board) {
      return undefined;
    }

    // Map board to target
    const target = BOARD_TO_TARGET[board.toLowerCase()];
    return target;
  } catch {
    return undefined;
  }
}

export default detectPlatformIOTarget;
