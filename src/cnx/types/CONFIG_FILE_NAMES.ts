/**
 * Issue #2165: the config file names, searched in this order in each
 * directory. `ConfigFileNames` (1.1 Discover) decides which one a directory's
 * config is; this is the list alone, for the layers that only name the files.
 */
const CONFIG_FILE_NAMES = ["cnx.config.json", ".cnx.json", ".cnxrc"] as const;

export default CONFIG_FILE_NAMES;
