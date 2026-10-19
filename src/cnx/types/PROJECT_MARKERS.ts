import CONFIG_FILE_NAMES from "./CONFIG_FILE_NAMES";

/**
 * What marks a project root (#1668). Every marker counts equally: the nearest
 * directory holding any wins, so the order decides nothing. That directory is
 * also where the config is read from, and no directory above it (#2261).
 * `IncludeDiscovery.findProjectRoot` walks to it; `--help` names it.
 */
const PROJECT_MARKERS: readonly string[] = [
  ...CONFIG_FILE_NAMES,
  "platformio.ini",
  ".git",
  "package.json",
];

export default PROJECT_MARKERS;
