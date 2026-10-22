import type ICnxMarker from "./types/ICnxMarker";
import GeneratedBanner from "../../utils/GeneratedBanner";

/**
 * Detects cnx generation markers in header files.
 *
 * Used by the C/C++ entry point feature to discover which headers
 * were generated from .cnx source files, and by header resolution to skip
 * a header the transpiler generated -- since #1435 the marker is that
 * header's only identity, not its basename.
 */
class CnxMarkerDetector {
  /** Matches the banner line */
  private static readonly MARKER_REGEX = GeneratedBanner.marker();

  /** Extracts the source path the banner records */
  private static readonly SOURCE_PATH_REGEX =
    GeneratedBanner.sourcePathMarker();

  /**
   * Check if content contains the cnx generation marker.
   */
  static isCnxGenerated(content: string): boolean {
    return CnxMarkerDetector.MARKER_REGEX.test(content);
  }

  /**
   * Find the cnx generation marker that records a source .cnx path.
   *
   * @param content - File content
   * @returns The recorded source path (e.g., "led.cnx") and the line and
   *   column it is written at, or null if no marker names a source
   */
  static findMarker(content: string): ICnxMarker | null {
    const match = CnxMarkerDetector.SOURCE_PATH_REGEX.exec(content);
    return match ? CnxMarkerDetector.markerAt(content, match) : null;
  }

  private static markerAt(content: string, match: RegExpExecArray): ICnxMarker {
    const sourcePath = match[1];
    // The name ends the match, so it starts this far into the file.
    const offset = match.index + match[0].length - sourcePath.length;
    const before = content.slice(0, offset);
    return {
      sourcePath,
      line: before.split("\n").length,
      column: offset - (before.lastIndexOf("\n") + 1),
    };
  }
}

export default CnxMarkerDetector;
