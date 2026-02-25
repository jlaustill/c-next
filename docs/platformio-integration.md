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
# Transpile all .cnx files in a directory (recursive)
cnext src/

# Or transpile specific files
cnext src/ConfigStorage.cnx
cnext src/SensorProcessor.cnx
```
