import type IPlatformIOEnv from "./IPlatformIOEnv";

/**
 * What a platformio.ini says about which platform a build is for: its
 * environments, and the `default_envs` a plain `pio run` builds.
 */
interface IPlatformIOProject {
  readonly path: string;
  readonly envs: readonly IPlatformIOEnv[];
  readonly defaultEnvs: readonly string[];
}

export default IPlatformIOProject;
