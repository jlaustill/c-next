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

| Field         | Purpose                                                                                                                                                                                             |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `include`     | Extra directories searched for C/C++ headers. **Must cover every C/C++ header you `#include`** (e.g. `.pio/libdeps` for PlatformIO libraries, `include/`). Critical for C++ auto-detection (below). |
| `headerOut`   | Directory for generated headers (e.g. `include`).                                                                                                                                                   |
| `basePath`    | Base path stripped from header output paths (only used with `headerOut`; e.g. `src`).                                                                                                               |
| `target`      | Target platform for ISR/atomic codegen (e.g. `teensy41`, `cortex-m0`).                                                                                                                              |
| `debugMode`   | Generate panic-on-overflow helpers.                                                                                                                                                                 |
| `noCache`     | Disable the `.cnx/` symbol cache.                                                                                                                                                                   |
| `cppRequired` | **Force** C++ output. Normally unnecessary — see auto-detection below.                                                                                                                              |

Example (Teensy + a C++ library such as FlexCAN_T4):

```json
{
  "target": "teensy41",
  "include": ["include/", ".pio/libdeps/"],
  "headerOut": "include",
  "basePath": "src",
  "noCache": true
}
```

## C vs C++ Output (auto-detection)

C-Next emits **C++** (`.cpp` + `.hpp`) when it parses a C++ header that your `.cnx`
`#include`s — templates, classes, namespaces (e.g. `FlexCAN_T4.h`, Arduino classes).
Otherwise it emits **C** (`.c` + `.h`). You do **not** normally need `cppRequired`.

> **Gotcha:** auto-detection only works on headers cnext can actually **find**. If
> you `#include <Arduino.h>` but it isn't on an `include` path, cnext can't see that
> it's C++ and falls back to C mode — and your C++ calls won't compile. Keep your
> C++ headers reachable via `include` (this is why `--pio-install` adds
> `.pio/libdeps`). Use `cppRequired: true` only as a manual override for when a
> needed C++ header genuinely can't be placed on the search path.

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
```
