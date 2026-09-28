# PlatformIO Integration

C-Next integrates seamlessly with PlatformIO embedded projects. The transpiler automatically converts `.cnx` files to `.c`, `.h`, and `.cpp` as needed before each build.

## Quick Setup

From your PlatformIO project root:

```bash
cnext --pio-install
```

This command:

- Creates `cnext_build.py` (pre-build transpilation script)
- Modifies `platformio.ini` to add `extra_scripts = pre:cnext_build.py`
- Creates/updates `cnext.config.json` (adds `.pio/libdeps` to `include`, sets `headerOut: include`)

## Project Configuration (`cnext.config.json`)

C-Next reads `cnext.config.json` (or `.cnext.json` / `.cnextrc`) from the project
root. `--pio-install` writes a working default; the fields you'll touch most:

| Field         | Purpose                                                                                                                                                                                                      |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `include`     | Extra directories searched for C/C++ headers. **Must cover every C/C++ header you `#include`** (e.g. `.pio/libdeps` for PlatformIO libraries, `include/`). Also how E0507 sees that a header is C++ (below). |
| `headerOut`   | Directory for generated headers (e.g. `include`).                                                                                                                                                            |
| `target`      | The program's target when its source names none (ADR-049), e.g. `teensy41`. A PlatformIO board can name it instead (below).                                                                                  |
| `debugMode`   | Generate panic-on-overflow helpers.                                                                                                                                                                          |
| `noCache`     | Disable the `.cnx/` symbol cache.                                                                                                                                                                            |
| `cppRequired` | Emit C++ (`.cpp`/`.hpp`) instead of C. Required for any project that includes C++ headers — see below.                                                                                                       |

Relative paths in `cnext.config.json` resolve against the directory holding the
config file. Paths passed as CLI flags (`-o`, `--header-out`, `-I`) resolve
against the current working directory. So `"headerOut": "include"` names the same
directory whether you run `cnext` from the project root or from `src/`, while
`--header-out include` follows your shell.

Example (Teensy + a C++ library such as FlexCAN_T4):

```json
{
  "target": "teensy41",
  "include": ["include/", ".pio/libdeps/"],
  "headerOut": "include",
  "noCache": true
}
```

## The Target

Every program has exactly one target (ADR-049). In a PlatformIO project you
usually need not name it: when no `#pragma target` and no `--target` (or config
`target`) says otherwise, the board of the environment being built names it.

- `cnext_build.py` passes the environment PlatformIO is building
  (`--pio-env $PIOENV`), so `pio run -e uno` builds for `uno`'s board.
- Run by hand, `cnext` uses `default_envs`, else every environment, and those
  must agree (E0511 if they do not).
- A board names a target when the catalog has that name (`teensy41`), or when its
  platform is `atmelavr` (target `avr`) or `native` (target `host`). Any other
  board is E0510 — name the target with `#pragma target <name>` or `target` in
  `cnext.config.json`. `cnext --help` lists the known targets.

The run prints the target it used and where it came from, e.g.
`Target: teensy41 (platformio)`, and `pio run` shows that line.

**Upgrading:** re-run `cnext --pio-install` after upgrading C-Next. It rewrites
`cnext_build.py`. A script written before the target was required passes no
`--pio-env`, so in a project whose environments name different targets and that
sets no `default_envs`, every build fails with E0511.

## C vs C++ Output

C-Next emits **C** (`.c` + `.h`) unless you tell it otherwise. To emit **C++**
(`.cpp` + `.hpp`), set `cppRequired: true` in `cnext.config.json` or pass `--cpp`.

If a run that did not declare C++ `#include`s a C++ header — a `.hpp`, or a `.h`
containing templates, classes, namespaces or access specifiers (`FlexCAN_T4.h`,
Arduino classes) — the transpile **fails with E0507** naming the header:

```
Error: 1:0 Pipeline failed: E0507: C++ header in 'lib/FlexCAN_T4/FlexCAN_T4.h', but this run does not target C++.
  C-Next emits C unless told otherwise. To compile as C++, set
  'cppRequired: true' in your config, or pass --cpp.
```

The `1:0` is the whole run, not a line in your source: the header is rejected while the
include graph is being collected, before any `#include` site is attributed to it. Grep for
`E0507` rather than for a position.

> **Previously** C-Next guessed: it read your includes and switched output languages
> on its own. That guess was only as good as the search path. If `Arduino.h` was not
> on an `include` path, C-Next could not see it was C++, quietly emitted C, and your
> C++ calls failed at the _compiler_ instead — with an error that pointed at
> generated code rather than at the missing path. Declaring the mode moves that
> failure to the transpiler, names the file, and names the fix.

Your `include` paths still matter for everything else — symbol resolution, macro
expansion, type checking — so keep C/C++ headers reachable (this is why
`--pio-install` adds `.pio/libdeps`).

## Usage

1. **Create `.cnx` files in your `src/` directory** (alongside existing `.c`/`.cpp` files)

```bash
src/
├── main.cpp              # Existing C++ code
├── ConfigStorage.cnx     # New c-next code
└── SensorProcessor.cnx   # New c-next code
```

2. **Build as usual** — transpilation happens automatically:

```bash
pio run
```

Output:

```
Transpiling 2 c-next files...
  ✓ ConfigStorage.cnx
  ✓ SensorProcessor.cnx
Building...
```

3. **Commit both `.cnx` and generated `.c|.cpp|.h` files** to version control

## Why Commit Generated Files?

Generated `.c|.cpp|.h` files are **reviewable artifacts** in pull requests:

```diff
+ // ConfigStorage.cnx
+ u8 validate_config() {
+     counter +<- 1;
+ }

+ // ConfigStorage.c (generated)
+ uint8_t validate_config(void) {
+     counter = cnx_clamp_add_u8(counter, 1);
+ }
```

**Benefits**:

- See exactly what C/CPP code the transpiler generates
- Review safety features (overflow protection, atomic operations)
- Verify transpiler behavior
- Build succeeds even if transpiler isn't available

This follows the same pattern as TypeScript committing `.js` files or Bison committing generated parsers.

## Example Project Structure

```
my-teensy-project/
├── platformio.ini           # PlatformIO config
├── cnext_build.py           # Auto-generated transpilation script
├── src/
│   ├── main.cpp             # C++ entry point
│   ├── ConfigStorage.cnx    # c-next source
│   ├── ConfigStorage.cpp    # Generated (committed)
│   ├── SensorProcessor.cnx  # c-next source
│   └── SensorProcessor.cpp  # Generated (committed)
└── include/
    └── AppConfig.h          # Shared types
```

## Uninstall

To remove c-next integration:

```bash
cnext --pio-uninstall
```

This removes:

- `cnext_build.py` script
- `extra_scripts` reference from `platformio.ini`

Your `.cnx` files and generated `.c|.cpp|.h` files remain untouched.

## Manual Integration

If you prefer manual control, you can also run the transpiler explicitly:

```bash
# Transpile from entry point (includes are followed automatically)
cnext src/main.cnx

# For one environment's board, as cnext_build.py does
cnext src/main.cnx --pio-env teensy41
```
