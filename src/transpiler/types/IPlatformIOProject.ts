import type IPlatformIOEnv from "./IPlatformIOEnv";

/**
 * What a platformio.ini says about which platform a build is for: its
 * environments, and the `default_envs` a plain `pio run` builds.
 */
interface IPlatformIOProject {
  readonly path: string;
  readonly envs: readonly IPlatformIOEnv[];
  readonly defaultEnvs: readonly string[];
  /**
   * The build machine's variable that added to `defaultEnvs`, and the names
   * only it gave -- a name the file lists too is the file's. Null when no
   * variable is set. A target diagnostic names the variable rather than
   * blaming the file (#1760 second review).
   */
  readonly machineDefaultEnvs: {
    readonly variable: string;
    readonly names: readonly string[];
  } | null;
}

export default IPlatformIOProject;
