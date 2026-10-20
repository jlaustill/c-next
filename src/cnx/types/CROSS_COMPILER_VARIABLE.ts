/**
 * Issue #2166: the environment variable that names the compiler a project
 * reads its headers with. `CrossCompilerVariable` (1.1 Discover) reads it;
 * this is the name alone, for the layers that only tell the user to set it.
 */
const CROSS_COMPILER_VARIABLE = "CNX_CROSS_COMPILER";

export default CROSS_COMPILER_VARIABLE;
