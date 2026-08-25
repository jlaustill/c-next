/**
 * Issue #1219: the file-relationship axis of the scope-context matrix.
 *
 * Depth is the longest resolved `.cnx` include chain reachable from a fixture:
 * 0 = same file, 1 = imported directly, 2+ = reached through an intermediate
 * file. That last case is its own failure class -- #1178 (an unresolvable
 * callee treated as pure) is 2+-hop only.
 *
 * Include extraction delegates to `IncludeDiscovery.extractIncludes`, the same
 * scanner the transpiler itself uses. Re-implementing the regex here would be a
 * second answer to "what does this file include", and the two would diverge the
 * first time the directive syntax gained a quirk -- that scanner already
 * documents two.
 */

import { existsSync } from "node:fs";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";

import IncludeDiscovery from "../../src/transpiler/data/IncludeDiscovery";

/**
 * Resolve one include directive to a real `.cnx` file.
 *
 * Resolve relative to the including file, then fall back to the shared search
 * paths -- the same order the test runner uses.
 *
 * `IncludeDiscovery` only matches a directive whose `#` is preceded by nothing
 * but whitespace on its line, so prose (`// Tests: #include <file.cnx>`) and
 * commented-out directives are already excluded before this point. The
 * filesystem check is therefore for genuinely unresolvable includes -- a
 * directive naming a file that is not there -- which must not be counted as a
 * hop.
 *
 * Note this is STRICTER than `TestUtils.findHelperCnxFiles`, whose unanchored
 * regex does match prose and relies on the filesystem check alone.
 */
function resolveCnxInclude(
  includePath: string,
  fromFile: string,
  searchPaths: readonly string[],
): string | null {
  if (!includePath.endsWith(".cnx")) return null;
  if (includePath.endsWith(".test.cnx")) return null;

  const beside = join(dirname(fromFile), includePath);
  if (existsSync(beside)) return beside;

  for (const searchPath of searchPaths) {
    const candidate = join(searchPath, includePath);
    if (existsSync(candidate)) return candidate;
  }

  return null;
}

/** Direct `.cnx` includes of a file that resolve to a real file. */
function directIncludes(
  file: string,
  searchPaths: readonly string[],
): string[] {
  if (!existsSync(file)) return [];

  let content: string;
  try {
    content = readFileSync(file, "utf-8");
  } catch {
    return [];
  }

  const resolved: string[] = [];
  for (const includePath of IncludeDiscovery.extractIncludes(content)) {
    const target = resolveCnxInclude(includePath, file, searchPaths);
    if (target !== null && !resolved.includes(target)) resolved.push(target);
  }
  return resolved;
}

/**
 * Longest resolved `.cnx` include chain reachable from `file`.
 *
 * `visited` is copied per branch rather than shared, so a diamond (two paths
 * reaching one file) still measures the longer path instead of whichever
 * branch happened to be walked first. It still terminates: a cycle revisits a
 * file already on the current path.
 */
function maxDepth(
  file: string,
  searchPaths: readonly string[] = [],
  visited: ReadonlySet<string> = new Set(),
): number {
  if (visited.has(file)) return 0;
  const onPath = new Set(visited);
  onPath.add(file);

  let deepest = 0;
  for (const included of directIncludes(file, searchPaths)) {
    // Skip a back-edge BEFORE counting it. Detecting the cycle inside the
    // recursive call is too late: the `1 +` has already charged a hop for an
    // edge that closes a loop, inflating depth by one and pushing a fixture
    // from `imported-direct` into `imported-transitive`.
    if (onPath.has(included)) continue;
    const branch = 1 + maxDepth(included, searchPaths, onPath);
    if (branch > deepest) deepest = branch;
  }
  return deepest;
}

class IncludeDepth {
  static resolveCnxInclude = resolveCnxInclude;
  static directIncludes = directIncludes;
  static maxDepth = maxDepth;
}

export default IncludeDepth;
