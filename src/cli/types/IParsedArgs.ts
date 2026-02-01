/**
 * Raw parsed command-line arguments
 */
interface IParsedArgs {
  /** Input files or directories */
  inputFiles: string[];
  /** Output path (file or directory) */
  outputPath: string;
  /** Additional include directories */
  includeDirs: string[];
  /** Preprocessor defines */
  defines: Record<string, string | boolean>;
  /** --cpp flag */
  cppRequired?: boolean;
  /** --target flag */
  target?: string;
  /** --no-preprocess flag (inverted: preprocess = true by default) */
  preprocess: boolean;
  /** --verbose flag */
  verbose: boolean;
  /** --no-cache flag */
  noCache: boolean;
  /** --parse flag */
  parseOnly: boolean;
  /** --header-out flag */
  headerOutDir?: string;
  /** --base-path flag */
  basePath?: string;
  /** --clean flag */
  cleanMode: boolean;
  /** --config flag */
  showConfig: boolean;
  /** --pio-install flag */
  pioInstall: boolean;
  /** --pio-uninstall flag */
  pioUninstall: boolean;
  /** --debug flag */
  debugMode: boolean;
}

export default IParsedArgs;
