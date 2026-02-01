import EFileType from "./EFileType";

/**
 * Discovered source file
 */
interface IDiscoveredFile {
  /** Absolute path to the file */
  path: string;

  /** File type */
  type: EFileType;

  /** File extension */
  extension: string;
}

export default IDiscoveredFile;
