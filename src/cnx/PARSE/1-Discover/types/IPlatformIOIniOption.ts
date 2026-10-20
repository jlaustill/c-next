/**
 * One option of a platformio.ini, where it is and what it holds. `lines` index
 * the file's lines (split at each line break): the key's line, then each
 * continuation line's. `lineValues` holds each of those lines' value, comment
 * dropped and trimmed, and `value` is them joined with "\n".
 */
interface IPlatformIOIniOption {
  readonly section: string;
  readonly key: string;
  readonly value: string;
  readonly lines: readonly number[];
  readonly lineValues: readonly string[];
}

export default IPlatformIOIniOption;
