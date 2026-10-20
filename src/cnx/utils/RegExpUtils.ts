/**
 * Building regular expressions from text that must match literally.
 */
class RegExpUtils {
  /** `text` with every character special to a regex escaped, so it matches only itself */
  static escape(text: string): string {
    return text.replaceAll(/[.*+?^${}()|[\]\\/]/g, String.raw`\$&`);
  }
}

export default RegExpUtils;
