import * as fs from "node:fs";

export function getAccessDescription(access: string): string {
  switch (access) {
    case "rw":
      return "read-write";
    case "ro":
      return "read-only";
    case "wo":
      return "write-only";
    case "w1c":
      return "write-1-to-clear";
    case "w1s":
      return "write-1-to-set";
    default:
      return access;
  }
}

export function getCompletionLabel(
  label: string | { label: string; description?: string },
): string {
  return typeof label === "string" ? label : label.label;
}

export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function findOutputPath(
  cnxFsPath: string,
  uriString: string,
  outputPathCache: Map<string, string>,
): string | null {
  const cppPath = cnxFsPath.replace(/\.cnx$/, ".cpp");
  if (fs.existsSync(cppPath)) return cppPath;
  const cPath = cnxFsPath.replace(/\.cnx$/, ".c");
  if (fs.existsSync(cPath)) return cPath;
  const cachedPath = outputPathCache.get(uriString);
  if (cachedPath && fs.existsSync(cachedPath)) return cachedPath;
  return null;
}

export const DIAGNOSTIC_DEBOUNCE_MS = 300;
export const EDITOR_SWITCH_DEBOUNCE_MS = 150;
export const CACHE_CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
export const MAX_GLOBAL_COMPLETION_ITEMS = 30;
export const MIN_PREFIX_LENGTH_FOR_CPP_QUERY = 2;
