/**
 * Issue #2165: the config file names, searched in this order in each
 * directory. `ConfigFileNames` (1.1 Discover) decides what a directory's
 * files under these and the old names mean; this is the list alone, for the
 * layers that only name the files.
 */
const CONFIG_FILE_NAMES = ["cnx.config.json", ".cnx.json", ".cnxrc"] as const;

export default CONFIG_FILE_NAMES;
