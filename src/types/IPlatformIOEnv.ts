/**
 * One `[env:NAME]` of a platformio.ini, with the two keys a target is
 * derived from. Each is absent when neither the env, what it extends, nor
 * the common `[env]` section sets it.
 */
interface IPlatformIOEnv {
  readonly name: string;
  readonly board?: string;
  readonly platform?: string;
}

export default IPlatformIOEnv;
