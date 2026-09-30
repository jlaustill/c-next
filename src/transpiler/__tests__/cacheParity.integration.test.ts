/**
 * Integration test for issue #1225: a warm `.cnx` cache must produce byte-identical
 * output to a cold one.
 *
 * The cache is a performance optimization. Nothing about it
 * licenses it to change generated code — but it did: a header naming a pointer
 * typedef included the header defining it on a cold build, and forward-declared
 * it as an incomplete struct on a warm one. Those are different types, and the
 * warm form does not compile (`extern handle_t my_handle;` declares an object of
 * incomplete type).
 *
 * The fixture is deliberately the shape that broke: `typedef struct opaque_t*
 * handle_t` is recorded ONLY in `SymbolTable.structState.pointerTypedefs` — the
 * C++ resolver records the flag and emits no symbol for it — so if the cache
 * drops that one fact, a warm build has never heard of `handle_t`.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  mkdtempSync,
  writeFileSync,
  rmSync,
  readFileSync,
  existsSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Transpiler from "../Transpiler";
import CacheManager from "../../utils/cache/CacheManager";
import CachedSymbolReader from "../../utils/cache/CachedSymbolReader";
import NodeFileSystem from "../NodeFileSystem";

const EXTERNAL_HPP = `#ifndef CNX_CACHE_PARITY_EXTERNAL_HPP
#define CNX_CACHE_PARITY_EXTERNAL_HPP

struct opaque_t {
    int value;
};

/* A pointer typedef: handle_t IS a pointer, not an incomplete struct. */
typedef struct opaque_t* handle_t;

void create_handle(handle_t *out) {
    static struct opaque_t storage = { 42 };
    *out = &storage;
}

int use_handle(handle_t h) {
    return h->value;
}

#endif /* CNX_CACHE_PARITY_EXTERNAL_HPP */
`;

const MAIN_CNX = `#include "external.hpp"

handle_t myHandle;

u32 main() {
    global.create_handle(myHandle);
    i32 value <- global.use_handle(myHandle);
    if (value != 42) return 1;
    return 0;
}
`;

/** Every generated artifact, keyed by file name. */
type TGenerated = Map<string, string>;

describe("cache parity (integration, #1225)", () => {
  let dir: string;

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), "cnext-cache-parity-"));
    // A project marker is what enables caching at all: determineProjectRoot
    // walks up for one, and returns undefined (caching off) if it finds none.
    // Putting it in the temp dir also keeps this test's cache out of the repo.
    writeFileSync(join(dir, "cnext.config.json"), "{}\n");
    writeFileSync(join(dir, "external.hpp"), EXTERNAL_HPP);
    writeFileSync(join(dir, "main.cnx"), MAIN_CNX);
  });

  afterAll(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  async function transpileOnce(): Promise<TGenerated> {
    const transpiler = new Transpiler(
      {
        input: join(dir, "main.cnx"),
        includeDirs: [dir],
        outDir: join(dir, "out"),
        cppRequired: true,
        target: "host",
      },
      NodeFileSystem.instance,
    );

    const result = await transpiler.transpile({ kind: "files" });
    expect(result.success).toBe(true);

    const generated: TGenerated = new Map();
    for (const file of result.outputFiles) {
      if (existsSync(file)) {
        generated.set(
          file.slice(file.lastIndexOf("/") + 1),
          readFileSync(file, "utf8"),
        );
      }
    }
    // A header is the artifact that broke; failing here beats silently
    // comparing two empty maps and calling that parity.
    expect([...generated.keys()].some((name) => name.endsWith(".hpp"))).toBe(
      true,
    );
    return generated;
  }

  it("produces identical output cold and warm", async () => {
    // First run populates .cnx/; the second reads it.
    const cold = await transpileOnce();
    expect(existsSync(join(dir, ".cnx"))).toBe(true);
    const warm = await transpileOnce();

    expect([...warm.keys()].sort()).toEqual([...cold.keys()].sort());
    for (const [name, coldContent] of cold) {
      expect(
        warm.get(name),
        `${name} differs between a cold and a warm cache`,
      ).toBe(coldContent);
    }
  });

  it("keeps the defining header rather than guessing a forward declaration", async () => {
    const warm = await transpileOnce();
    const header = [...warm.entries()].find(([name]) =>
      name.endsWith(".hpp"),
    )![1];

    expect(header).toContain('#include "external.hpp"');
    // The guess this issue is named for: an incomplete struct where the truth
    // is a pointer to opaque_t.
    expect(header).not.toContain("typedef struct handle_t handle_t;");
  });

  // #1817: an entry that is current (its key still matches the file) but
  // unusable is a miss, and the header is parsed again -- two separate checks,
  // one per way an entry can be unusable, and neither was reached by a test.
  // Each rewrites external.hpp's entry through the cache's own API, then
  // asserts the entry now takes the branch it is meant to reach.
  type TEntry = NonNullable<ReturnType<CacheManager["getSymbols"]>>;

  /**
   * The output with external.hpp parsed afresh: its entry is dropped first, so
   * this run writes a new one. Each test starts here, so none depends on the
   * entry an earlier test left behind.
   */
  async function coldOutput(): Promise<TGenerated> {
    const cache = new CacheManager(dir, NodeFileSystem.instance);
    await cache.initialize();
    cache.invalidate(join(dir, "external.hpp"));
    await cache.flush();
    return transpileOnce();
  }

  async function rewriteEntry(
    rewrite: (cache: CacheManager, path: string, entry: TEntry) => void,
  ): Promise<CacheManager> {
    const path = join(dir, "external.hpp");
    const cache = new CacheManager(dir, NodeFileSystem.instance);
    await cache.initialize();
    const entry = cache.getSymbols(path);
    expect(entry, "the run before left a usable entry").not.toBeNull();
    rewrite(cache, path, entry!);
    await cache.flush();
    return cache;
  }

  it("parses the header again when its entry's struct state cannot be read", async () => {
    const expected = await coldOutput();
    const cache = await rewriteEntry((c, path, entry) =>
      c.setSymbols(path, entry.symbols, entry.structFields, {
        structState: { opaqueTypes: 5 } as never,
      }),
    );
    expect(cache.isValid(join(dir, "external.hpp"))).toBe(true);
    expect(cache.getSymbols(join(dir, "external.hpp"))).toBeNull();

    expect(await transpileOnce()).toEqual(expected);
  });

  it("parses the header again when its entry's symbols do not validate", async () => {
    const expected = await coldOutput();
    const cache = await rewriteEntry((c, path, entry) =>
      c.setSymbols(path, [{ kind: "not-a-symbol" }], entry.structFields, {
        structState: entry.structState,
        needsStructKeyword: entry.needsStructKeyword,
        enumBitWidth: entry.enumBitWidth,
        preprocessFailed: entry.preprocessFailed,
      }),
    );
    const rewritten = cache.getSymbols(join(dir, "external.hpp"));
    expect(rewritten).not.toBeNull();
    expect(CachedSymbolReader.read(rewritten!.symbols)).toBeNull();

    expect(await transpileOnce()).toEqual(expected);
  });
});
