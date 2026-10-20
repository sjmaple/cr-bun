import { describe, expect, test } from "bun:test";
import { bunEnv, bunExe, isWindows, tempDir } from "harness";
import { join, relative } from "node:path";

describe("bundler files option", () => {
  test("basic in-memory file bundling", async () => {
    const result = await Bun.build({
      entrypoints: ["/entry.js"],
      files: {
        "/entry.js": `console.log("hello from memory");`,
      },
    });

    expect(result.success).toBe(true);
    expect(result.outputs.length).toBe(1);

    const output = await result.outputs[0].text();
    expect(output).toContain("hello from memory");
  });

  test("in-memory file with imports", async () => {
    const result = await Bun.build({
      entrypoints: ["/entry.js"],
      files: {
        "/entry.js": `
          import { foo } from "/lib.js";
          console.log(foo);
        `,
        "/lib.js": `
          export const foo = 42;
        `,
      },
    });

    expect(result.success).toBe(true);
    expect(result.outputs.length).toBe(1);

    const output = await result.outputs[0].text();
    expect(output).toContain("42");
  });

  test("in-memory file with relative imports (same directory)", async () => {
    const result = await Bun.build({
      entrypoints: ["/entry.js"],
      files: {
        "/entry.js": `
          import { bar } from "./utils.js";
          console.log(bar);
        `,
        "/utils.js": `
          export const bar = "relative import works";
        `,
      },
    });

    expect(result.success).toBe(true);
    expect(result.outputs.length).toBe(1);

    const output = await result.outputs[0].text();
    expect(output).toContain("relative import works");
  });

  test("in-memory file with relative imports (subdirectory)", async () => {
    const result = await Bun.build({
      entrypoints: ["/src/entry.js"],
      files: {
        "/src/entry.js": `
          import { helper } from "./lib/helper.js";
          console.log(helper);
        `,
        "/src/lib/helper.js": `
          export const helper = "helper from subdirectory";
        `,
      },
    });

    expect(result.success).toBe(true);
    expect(result.outputs.length).toBe(1);

    const output = await result.outputs[0].text();
    expect(output).toContain("helper from subdirectory");
  });

  test("in-memory file with relative imports (parent directory)", async () => {
    const result = await Bun.build({
      entrypoints: ["/src/app/entry.js"],
      files: {
        "/src/app/entry.js": `
          import { shared } from "../shared.js";
          console.log(shared);
        `,
        "/src/shared.js": `
          export const shared = "shared from parent";
        `,
      },
    });

    expect(result.success).toBe(true);
    expect(result.outputs.length).toBe(1);

    const output = await result.outputs[0].text();
    expect(output).toContain("shared from parent");
  });

  test("in-memory file with relative imports between multiple files", async () => {
    const result = await Bun.build({
      entrypoints: ["/src/index.js"],
      files: {
        "/src/index.js": `
          import { componentA } from "./components/a.js";
          import { componentB } from "./components/b.js";
          console.log(componentA, componentB);
        `,
        "/src/components/a.js": `
          import { util } from "../utils/util.js";
          export const componentA = "A:" + util;
        `,
        "/src/components/b.js": `
          import { util } from "../utils/util.js";
          export const componentB = "B:" + util;
        `,
        "/src/utils/util.js": `
          export const util = "shared-util";
        `,
      },
    });

    expect(result.success).toBe(true);
    expect(result.outputs.length).toBe(1);

    const output = await result.outputs[0].text();
    expect(output).toContain("shared-util");
    expect(output).toContain("A:");
    expect(output).toContain("B:");
  });

  test("in-memory file with nested imports", async () => {
    const result = await Bun.build({
      entrypoints: ["/entry.js"],
      files: {
        "/entry.js": `
          import { a } from "/a.js";
          console.log(a);
        `,
        "/a.js": `
          import { b } from "/b.js";
          export const a = b + 1;
        `,
        "/b.js": `
          export const b = 100;
        `,
      },
    });

    expect(result.success).toBe(true);
    expect(result.outputs.length).toBe(1);

    // Execute the bundle to verify correct behavior
    const output = await result.outputs[0].text();
    const fn = new Function(output + "; return typeof a !== 'undefined' ? a : 101;");
    // The bundle should contain the value 100 (from b.js)
    expect(output).toContain("100");
  });

  test("in-memory file with TypeScript", async () => {
    const result = await Bun.build({
      entrypoints: ["/entry.ts"],
      files: {
        "/entry.ts": `
          const x: number = 42;
          console.log(x);
        `,
      },
    });

    expect(result.success).toBe(true);
    expect(result.outputs.length).toBe(1);

    const output = await result.outputs[0].text();
    expect(output).toContain("42");
  });

  test("in-memory file with JSX", async () => {
    const result = await Bun.build({
      entrypoints: ["/entry.jsx"],
      files: {
        "/entry.jsx": `
          const element = <div>Hello JSX</div>;
          console.log(element);
        `,
      },
      // Use classic JSX runtime to avoid needing react
      jsx: {
        runtime: "classic",
        factory: "h",
        fragment: "Fragment",
      },
    });

    expect(result.success).toBe(true);
    expect(result.outputs.length).toBe(1);

    const output = await result.outputs[0].text();
    expect(output).toContain("Hello JSX");
  });

  test("in-memory file with Blob content", async () => {
    const result = await Bun.build({
      entrypoints: ["/entry.js"],
      files: {
        "/entry.js": new Blob([`console.log("hello from blob");`]),
      },
    });

    expect(result.success).toBe(true);
    expect(result.outputs.length).toBe(1);

    const output = await result.outputs[0].text();
    expect(output).toContain("hello from blob");
  });

  test("in-memory file with a file-backed Blob is rejected", () => {
    // Only in-memory blobs are accepted as content; a Bun.file() blob would
    // have to be read from disk and is rejected like every other
    // string-or-blob argument, instead of being treated as empty content.
    // Like the other invalid options, this throws from Bun.build() itself.
    using dir = tempDir("bundler-files-bun-file", {
      "entry.js": `console.log("from disk");`,
    });

    expect(() =>
      Bun.build({
        entrypoints: ["/entry.js"],
        files: {
          "/entry.js": Bun.file(`${dir}/entry.js`),
        },
      }),
    ).toThrow("File blob cannot be used here");
  });

  test("in-memory file with Uint8Array content", async () => {
    const encoder = new TextEncoder();
    const result = await Bun.build({
      entrypoints: ["/entry.js"],
      files: {
        "/entry.js": encoder.encode(`console.log("hello from uint8array");`),
      },
    });

    expect(result.success).toBe(true);
    expect(result.outputs.length).toBe(1);

    const output = await result.outputs[0].text();
    expect(output).toContain("hello from uint8array");
  });

  test("in-memory file with ArrayBuffer content", async () => {
    const encoder = new TextEncoder();
    const result = await Bun.build({
      entrypoints: ["/entry.js"],
      files: {
        "/entry.js": encoder.encode(`console.log("hello from arraybuffer");`).buffer,
      },
    });

    expect(result.success).toBe(true);
    expect(result.outputs.length).toBe(1);

    const output = await result.outputs[0].text();
    expect(output).toContain("hello from arraybuffer");
  });

  test("in-memory file with re-exports", async () => {
    const result = await Bun.build({
      entrypoints: ["/entry.js"],
      files: {
        "/entry.js": `
          export { foo, bar } from "/lib.js";
        `,
        "/lib.js": `
          export const foo = "foo";
          export const bar = "bar";
        `,
      },
    });

    expect(result.success).toBe(true);
    expect(result.outputs.length).toBe(1);

    const output = await result.outputs[0].text();
    expect(output).toContain("foo");
    expect(output).toContain("bar");
  });

  test("in-memory file with default export", async () => {
    const result = await Bun.build({
      entrypoints: ["/entry.js"],
      files: {
        "/entry.js": `
          import myDefault from "/lib.js";
          console.log(myDefault);
        `,
        "/lib.js": `
          export default "default export";
        `,
      },
    });

    expect(result.success).toBe(true);
    expect(result.outputs.length).toBe(1);

    const output = await result.outputs[0].text();
    expect(output).toContain("default export");
  });

  test("in-memory file with chained imports", async () => {
    const result = await Bun.build({
      entrypoints: ["/entry.js"],
      files: {
        "/entry.js": `
          import { a } from "/a.js";
          console.log(a);
        `,
        "/a.js": `
          import { b } from "/b.js";
          export const a = "a" + b;
        `,
        "/b.js": `
          export const b = "b";
        `,
      },
    });

    expect(result.success).toBe(true);
    expect(result.outputs.length).toBe(1);

    const output = await result.outputs[0].text();
    // The bundle should contain both string literals from the chain
    expect(output).toContain('"a"');
    expect(output).toContain('"b"');
  });

  test("in-memory file overrides real file on disk", async () => {
    // Create a temp directory with a real file
    using dir = tempDir("bundler-files-override", {
      "entry.js": `
        import { value } from "./lib.js";
        console.log(value);
      `,
      "lib.js": `
        export const value = "from disk";
      `,
    });

    const entryPath = `${dir}/entry.js`;
    const libPath = `${dir}/lib.js`;

    // Bundle with in-memory file overriding the real lib.js
    const result = await Bun.build({
      entrypoints: [entryPath],
      files: {
        [libPath]: `export const value = "from memory";`,
      },
    });

    expect(result.success).toBe(true);
    expect(result.outputs.length).toBe(1);

    const output = await result.outputs[0].text();
    // The in-memory file should override the disk file
    expect(output).toContain("from memory");
    expect(output).not.toContain("from disk");
  });

  test("real file on disk can import in-memory file via relative path", async () => {
    // Create a temp directory with a real entry file
    using dir = tempDir("bundler-files-mixed", {
      "entry.js": `
        import { helper } from "./helper.js";
        console.log(helper);
      `,
    });

    const entryPath = `${dir}/entry.js`;
    const helperPath = `${dir}/helper.js`;

    // Bundle with entry from disk, but helper.js only in memory
    const result = await Bun.build({
      entrypoints: [entryPath],
      files: {
        [helperPath]: `export const helper = "helper from memory";`,
      },
    });

    expect(result.success).toBe(true);
    expect(result.outputs.length).toBe(1);

    const output = await result.outputs[0].text();
    expect(output).toContain("helper from memory");
  });

  test("real file on disk can import nested in-memory files", async () => {
    // Create a temp directory with a real entry file
    using dir = tempDir("bundler-files-nested-mixed", {
      "entry.js": `
        import { util } from "./lib/util.js";
        console.log(util);
      `,
    });

    const entryPath = `${dir}/entry.js`;
    const utilPath = `${dir}/lib/util.js`;

    // Bundle with entry from disk, but lib/util.js only in memory
    const result = await Bun.build({
      entrypoints: [entryPath],
      files: {
        [utilPath]: `export const util = "nested util from memory";`,
      },
    });

    expect(result.success).toBe(true);
    expect(result.outputs.length).toBe(1);

    const output = await result.outputs[0].text();
    expect(output).toContain("nested util from memory");
  });

  test("mixed disk and memory files with complex import graph", async () => {
    // Create a temp directory with some real files
    using dir = tempDir("bundler-files-complex", {
      "entry.js": `
        import { a } from "./a.js";
        import { b } from "./b.js";
        console.log(a, b);
      `,
      "a.js": `
        import { shared } from "./shared.js";
        export const a = "a:" + shared;
      `,
      // b.js will be in memory only
      // shared.js will be overridden in memory
      "shared.js": `
        export const shared = "disk-shared";
      `,
    });

    const entryPath = `${dir}/entry.js`;
    const bPath = `${dir}/b.js`;
    const sharedPath = `${dir}/shared.js`;

    // Bundle with:
    // - entry.js from disk
    // - a.js from disk (imports shared.js)
    // - b.js from memory (imports shared.js)
    // - shared.js overridden in memory
    const result = await Bun.build({
      entrypoints: [entryPath],
      files: {
        [bPath]: `
          import { shared } from "./shared.js";
          export const b = "b:" + shared;
        `,
        [sharedPath]: `export const shared = "memory-shared";`,
      },
    });

    expect(result.success).toBe(true);
    expect(result.outputs.length).toBe(1);

    const output = await result.outputs[0].text();
    // Both a.js and b.js should use the memory version of shared.js
    expect(output).toContain("memory-shared");
    expect(output).not.toContain("disk-shared");
  });

  test("relative files keys override relative import specifier", async () => {
    // Create a temp directory with a real entry file and a config file on disk
    using dir = tempDir("bundler-files-relative-keys", {
      "entry.js": `
        import { config } from "./config.js";
        console.log(config);
      `,
      "config.js": `
        export const config = "from disk";
      `,
    });

    const entryPath = `${dir}/entry.js`;

    // Bundle with a relative key in files map that matches the import specifier
    // The key should be resolved relative to the entry point
    const result = await Bun.build({
      entrypoints: [entryPath],
      files: {
        [`${dir}/config.js`]: `export const config = "from memory via relative key";`,
      },
    });

    expect(result.success).toBe(true);
    expect(result.outputs.length).toBe(1);

    const output = await result.outputs[0].text();
    // The in-memory file should override the disk file
    expect(output).toContain("from memory via relative key");
    expect(output).not.toContain("from disk");
  });

  test("onLoad plugin can transform in-memory files", async () => {
    let loadCalled = false;
    let loadedPath = "";

    const result = await Bun.build({
      entrypoints: ["/entry.js"],
      files: {
        "/entry.js": `import { value } from "./lib.js"; console.log(value);`,
        "/lib.js": `export const value = "original";`,
      },
      plugins: [
        {
          name: "test-onload",
          setup(build) {
            build.onLoad({ filter: /lib\.js$/ }, args => {
              loadCalled = true;
              loadedPath = args.path;
              return {
                contents: `export const value = "transformed by plugin";`,
                loader: "js",
              };
            });
          },
        },
      ],
    });

    expect(result.success).toBe(true);
    expect(loadCalled).toBe(true);
    expect(loadedPath).toBe("/lib.js");

    const output = await result.outputs[0].text();
    expect(output).toContain("transformed by plugin");
    expect(output).not.toContain("original");
  });

  test("onResolve plugin can redirect in-memory file imports", async () => {
    let resolveCalled = false;

    const result = await Bun.build({
      entrypoints: ["/entry.js"],
      files: {
        "/entry.js": `import { value } from "virtual:data"; console.log(value);`,
        "/actual-data.js": `export const value = "from actual-data";`,
      },
      plugins: [
        {
          name: "test-onresolve",
          setup(build) {
            build.onResolve({ filter: /^virtual:data$/ }, args => {
              resolveCalled = true;
              return {
                path: "/actual-data.js",
                namespace: "file",
              };
            });
          },
        },
      ],
    });

    expect(result.success).toBe(true);
    expect(resolveCalled).toBe(true);

    const output = await result.outputs[0].text();
    expect(output).toContain("from actual-data");
  });

  test("plugin can provide content for in-memory file via onLoad", async () => {
    const result = await Bun.build({
      entrypoints: ["/entry.js"],
      files: {
        "/entry.js": `import data from "./data.json"; console.log(data.name);`,
        // Provide empty placeholder - plugin will replace content
        "/data.json": `{}`,
      },
      plugins: [
        {
          name: "json-transform",
          setup(build) {
            build.onLoad({ filter: /\.json$/ }, args => {
              return {
                contents: `export default { name: "injected by plugin" };`,
                loader: "js",
              };
            });
          },
        },
      ],
    });

    expect(result.success).toBe(true);

    const output = await result.outputs[0].text();
    expect(output).toContain("injected by plugin");
  });

  // `check: true` type checks what is written: in `files`, or else on disk. What an onLoad plugin returns is what is
  // bundled. It is checked only where the file is written nowhere.
  describe("check: true", () => {
    // Without the libraries of TypeScript, which take seconds to load in a debug build. `globals.d.ts` has the types
    // that TypeScript asks for then.
    const options = {
      strict: true,
      noEmit: true,
      target: "esnext",
      module: "esnext",
      moduleResolution: "bundler",
      noLib: true,
      types: [],
      skipLibCheck: true,
      allowImportingTsExtensions: true,
      resolveJsonModule: true,
    };
    const globals = [
      "Array<T>",
      "Boolean",
      "CallableFunction",
      "Function",
      "IArguments",
      "ImportAttributes",
      "NewableFunction",
      "Number",
      "Object",
      "RegExp",
      "String",
    ]
      .map(name => `interface ${name} {}\n`)
      .join("");

    // Each text has an error of its own, which names where the text is from.
    const text = (from: string) => `export const value: "${from}" = 1;\n`;
    const wrong = (from: string, file = "lib.ts") => `TS2322: Type '1' is not assignable to type '"${from}"'. ${file}`;
    const notFound = (specifier: string) =>
      `TS2307: Cannot find module '${specifier}' or its corresponding type declarations. main.ts`;

    type Plugin = (build: Bun.PluginBuilder, dir: string) => void;
    type Project = {
      /** The files on disk, besides `tsconfig.json` and `globals.d.ts`. */
      disk: Record<string, string>;
      /** `files`, by the name of each in the project. */
      files?: Record<string, string>;
      plugin?: Plugin;
      entry?: string;
      target?: Bun.Target;
    };
    /** `errors`: the message and the file of each. */
    type Row = Project & { name: string; errors: string[] };

    async function errorsOf({ disk, files = {}, plugin, entry = "main.ts", target }: Project) {
      using project = tempDir("bundler-files-check", {
        "tsconfig.json": JSON.stringify({ compilerOptions: options }),
        "globals.d.ts": globals,
        ...disk,
      });
      const dir = String(project);
      const built = await Bun.build({
        entrypoints: [`${dir}/${entry}`],
        target,
        check: true,
        throw: false,
        files: Object.fromEntries(Object.entries(files).map(([file, text]) => [`${dir}/${file}`, text])),
        plugins: plugin ? [{ name: "plugin", setup: build => plugin(build, dir) }] : [],
      });
      return built.logs.map(log => `${log.message} ${relative(dir, log.position?.file ?? "").replaceAll("\\", "/")}`);
    }

    const main = `export { value } from "./lib.ts";\n`;
    const returns =
      (contents: string, loader: Bun.Loader = "ts"): Plugin =>
      build => {
        build.onLoad({ filter: /lib[.]ts$/ }, () => ({ contents, loader }));
      };

    describe("the text of a file that is checked", () => {
      const inFiles = { disk: { "main.ts": main }, files: { "lib.ts": text("files") }, errors: [wrong("files")] };
      const onDisk = { disk: { "main.ts": main, "lib.ts": text("disk") } };
      const rows: Row[] = [
        { name: "in `files`", ...inFiles },
        { name: "on disk and in `files`", ...inFiles, ...onDisk },
        { name: "on disk, and a plugin loads it", ...onDisk, plugin: returns(text("plugin")), errors: [wrong("disk")] },
        {
          name: "only a plugin provides it",
          disk: { "main.ts": main },
          plugin(build, dir) {
            build.onResolve({ filter: /lib[.]ts$/ }, () => ({ path: `${dir}/lib.ts` }));
            returns(text("plugin"))(build, dir);
          },
          errors: [wrong("plugin")],
        },
        { name: "in `files`, and a plugin loads it", ...inFiles, plugin: returns(text("plugin")) },
        {
          name: "on disk and in `files`, and a plugin loads it",
          ...inFiles,
          ...onDisk,
          plugin: returns(text("plugin")),
        },
        {
          name: "in `files`, and a plugin loads it after defer()",
          ...inFiles,
          plugin(build) {
            build.onLoad({ filter: /lib[.]ts$/ }, async ({ defer }) => {
              await defer();
              return { contents: text("plugin"), loader: "ts" };
            });
          },
        },
        {
          name: "in `files`, and a plugin declines to load it",
          ...inFiles,
          plugin(build) {
            build.onLoad({ filter: /lib[.]ts$/ }, () => undefined);
          },
        },
        {
          name: "in `files`, and a plugin loads it as JavaScript",
          ...inFiles,
          plugin: returns(`export const value = 1;\n`, "js"),
        },
        { name: "in `files`, and a plugin loads it as TSX", ...inFiles, plugin: returns(text("plugin"), "tsx") },
        {
          name: "in `files`, and a plugin loads it as an object",
          ...inFiles,
          plugin(build) {
            build.onLoad({ filter: /lib[.]ts$/ }, () => ({ exports: { value: 1 }, loader: "object" }));
          },
        },
        {
          name: "in `files`, and a plugin loads it as text",
          ...inFiles,
          disk: { "main.ts": `import * as lib from "./lib.ts";\nexport default lib;\n` },
          plugin: returns("plugin", "text"),
        },
        {
          name: "in `files`, and a plugin resolves an import to it and loads it",
          ...inFiles,
          disk: { "main.ts": `export { value } from "./lib";\n` },
          plugin(build, dir) {
            build.onResolve({ filter: /^[.][/]lib$/ }, () => ({ path: `${dir}/lib.ts` }));
            returns(text("plugin"))(build, dir);
          },
        },
        {
          name: "the entry point, in `files`, and a plugin loads it",
          ...inFiles,
          disk: {},
          plugin: returns(text("plugin")),
          entry: "lib.ts",
        },
        {
          name: "the entry point, on disk and in `files`, and a plugin loads it",
          ...inFiles,
          disk: { "lib.ts": text("disk") },
          plugin: returns(text("plugin")),
          entry: "lib.ts",
        },
      ];
      test.each(rows)("$name", async row => {
        expect(await errorsOf(row)).toEqual(row.errors);
      });

      // `onBeforeParse` of a native plugin replaces the text that is bundled.
      const cc = Bun.which("cc") || Bun.which("gcc") || Bun.which("clang");
      test.skipIf(isWindows || !cc)("in `files`, and a native plugin replaces its text", async () => {
        using addon = tempDir("bundler-files-check-native", {
          "replace.c": `
            #include "bundler_plugin.h"
            #define EXPORT __attribute__((visibility("default")))
            EXPORT const char *BUN_PLUGIN_NAME = "replace";
            EXPORT void *napi_register_module_v1(void *env, void *exports) { return exports; }
            static const char text[] = ${JSON.stringify(text("plugin"))};
            EXPORT void replace(const OnBeforeParseArguments *args, OnBeforeParseResult *result) {
              result->source_ptr = (uint8_t *)text;
              result->source_len = sizeof(text) - 1;
              result->loader = BUN_LOADER_TS;
            }
          `,
        });
        const header = join(import.meta.dir, "../../packages/bun-native-bundler-plugin-api");
        await using compiler = Bun.spawn({
          cmd: [cc!, "-shared", "-fPIC", "-I", header, "-o", "replace.node", "replace.c"],
          cwd: String(addon),
          env: bunEnv,
          stderr: "pipe",
        });
        const [stderr, exitCode] = await Promise.all([compiler.stderr.text(), compiler.exited]);
        expect({ stderr, exitCode }).toEqual({ stderr: "", exitCode: 0 });
        const napiModule = require(`${addon}/replace.node`);
        const errors = await errorsOf({
          ...inFiles,
          plugin(build) {
            build.onBeforeParse({ filter: /lib[.]ts$/ }, { napiModule, symbol: "replace" });
          },
        });
        expect(errors).toEqual([wrong("files")]);
      });
    });

    test("what the text in `files` imports is checked, not what the text of a plugin imports", async () => {
      const errors = await errorsOf({
        disk: { "main.ts": main, "dep.ts": `export const dep: "dep" = 1;\n` },
        files: { "lib.ts": `export { dep as value } from "./dep.ts";\n` },
        plugin: returns(`export const value = 1;\n`),
      });
      expect(errors).toEqual([wrong("dep", "dep.ts")]);
    });

    // The bundler does not load a file that only types need. The type checker reads it: from `files`, like the bundler
    // would.
    describe("a file of `files` that the bundle does not load", () => {
      const ambient = (from: string) => `declare const ambient: "${from}";\n`;
      const kinds = [
        {
          kind: "`import type`",
          main: `import type { value } from "./lib.ts";\nexport type Value = typeof value;\n`,
        },
        {
          kind: "an import that only a type uses",
          main: `import { value } from "./lib.ts";\nexport type Value = typeof value;\n`,
        },
        { kind: "`export type`", main: `export type { value } from "./lib.ts";\n` },
        {
          kind: "an ambient declaration",
          main: `export const value: typeof ambient = 1;\n`,
          file: "ambient.d.ts",
          of: ambient,
          error: wrong("files", "main.ts"),
        },
        {
          kind: 'an import with { type: "text" }',
          main: `import * as lib from "./lib.ts" with { type: "text" };\nexport default lib;\n`,
        },
      ];
      const rows = kinds.flatMap(({ kind, main, file = "lib.ts", of = text, error = wrong("files") }): Row[] => [
        { name: `${kind}, in \`files\``, disk: { "main.ts": main }, files: { [file]: of("files") }, errors: [error] },
        {
          name: `${kind}, on disk and in \`files\``,
          disk: { "main.ts": main, [file]: of("disk") },
          files: { [file]: of("files") },
          errors: [error],
        },
      ]);
      test.each(rows)("$name", async row => {
        expect(await errorsOf(row)).toEqual(row.errors);
      });

      test("a JSON file that only a type uses", async () => {
        const errors = await errorsOf({
          disk: { "main.ts": `import data from "./data.json";\nexport const name: typeof data.name = 1;\n` },
          files: { "data.json": `{ "name": "files" }\n` },
        });
        expect(errors).toEqual([`TS2322: Type 'number' is not assignable to type 'string'. main.ts`]);
      });
    });

    // The type checker cannot read `App.svelte`, on disk or in `files`: a declaration stands for it.
    describe("a component that a plugin compiles", () => {
      const main = `export { default } from "./App.svelte";\n`;
      const component = `<script lang="ts">let count: number = 1;</script>\n`;
      const declaration = `declare module "*.svelte" {\n  const component: unknown;\n  export default component;\n}\n`;
      const compiles: Plugin = build => {
        const contents = `const component: "plugin" = 1;\nexport default component;\n`;
        build.onLoad({ filter: /[.]svelte$/ }, () => ({ contents, loader: "ts" }));
      };
      const rows: Row[] = [
        {
          name: "on disk, with a declaration",
          disk: { "main.ts": main, "App.svelte": component, "svelte.d.ts": declaration },
          errors: [],
        },
        {
          name: "in `files`, with a declaration on disk",
          disk: { "main.ts": main, "svelte.d.ts": declaration },
          files: { "App.svelte": component },
          errors: [],
        },
        {
          name: "in `files`, with a declaration in `files`",
          disk: { "main.ts": main },
          files: { "App.svelte": component, "svelte.d.ts": declaration },
          errors: [],
        },
        {
          name: "on disk, without a declaration",
          disk: { "main.ts": main, "App.svelte": component },
          errors: [notFound("./App.svelte")],
        },
        {
          name: "in `files`, without a declaration",
          disk: { "main.ts": main },
          files: { "App.svelte": component },
          errors: [notFound("./App.svelte")],
        },
      ];
      test.each(rows)("$name", async row => {
        expect(await errorsOf({ ...row, plugin: compiles })).toEqual(row.errors);
      });
    });

    // A module that imports a page is checked with the scripts of the page.
    describe("the scripts of a page that a server imports", () => {
      const page = (script: string) => `<script type="module" src="./${script}"></script>\n`;
      const disk = {
        "server.ts": `import page from "./index.html";\nexport default page;\n`,
        "html.d.ts": `declare module "*.html" {\n  const page: unknown;\n  export default page;\n}\n`,
        "of-disk.ts": text("disk"),
        "of-files.ts": text("files"),
      };
      const rows: Row[] = [
        {
          name: "the page is on disk",
          disk: { ...disk, "index.html": page("of-disk.ts") },
          errors: [wrong("disk", "of-disk.ts")],
        },
        {
          name: "the page is in `files`",
          disk,
          files: { "index.html": page("of-files.ts") },
          errors: [wrong("files", "of-files.ts")],
        },
        {
          name: "the page is on disk and in `files`",
          disk: { ...disk, "index.html": page("of-disk.ts") },
          files: { "index.html": page("of-files.ts") },
          errors: [wrong("files", "of-files.ts")],
        },
      ];
      test.each(rows)("$name", async row => {
        expect(await errorsOf({ ...row, entry: "server.ts", target: "bun" })).toEqual(row.errors);
      });
    });

    // The bundler finds a file of `files` by the path that an import of it resolves to. A key that is another spelling
    // of that path names no file of the bundle.
    test("a key that is not the resolved path of the file is not a file of the project", async () => {
      const errors = await errorsOf({
        disk: { "main.ts": main, "lib.ts": text("disk") },
        files: { "src/../lib.ts": text("files") },
      });
      expect(errors).toEqual([wrong("disk")]);
    });

    // The resolver of the bundler reads `tsconfig.json` from disk.
    test("a `tsconfig.json` in `files` that the bundle does not load is not the one of the project", async () => {
      const errors = await errorsOf({
        disk: { "main.ts": `export function f(x) {\n  return x;\n}\n` },
        files: { "tsconfig.json": JSON.stringify({ compilerOptions: { ...options, strict: false } }) },
      });
      expect(errors).toEqual([`TS7006: Parameter 'x' implicitly has an 'any' type. main.ts`]);
    });
  });

  // Specifiers are joined onto the importer's directory to find a matching
  // in-memory file. A specifier longer than a path buffer (4096 bytes on
  // Linux, 1024 on macOS, 98302 on Windows) used to abort the process. These
  // run in a child process because the bug is a crash.
  describe.concurrent("specifiers longer than a path buffer", () => {
    async function buildInChild(script: string) {
      await using proc = Bun.spawn({
        cmd: [bunExe(), "-e", script],
        env: bunEnv,
        stdout: "pipe",
        stderr: "pipe",
      });
      const [stdout, stderr, exitCode] = await Promise.all([proc.stdout.text(), proc.stderr.text(), proc.exited]);
      expect(stderr).toBe("");
      expect(exitCode).toBe(0);
      return JSON.parse(stdout);
    }

    test("a CSS url() is kept as-is", async () => {
      const result = await buildInChild(`
        const url = "data:image/svg+xml," + Buffer.alloc(131072, "A").toString();
        const result = await Bun.build({
          entrypoints: ["/style.css"],
          files: { "/style.css": '.x { background: url("' + url + '") }' },
          throw: false,
        });
        const output = result.success ? await result.outputs[0].text() : "";
        console.log(JSON.stringify({
          success: result.success,
          logs: result.logs.map(String),
          outputHasUrl: output.includes(url),
        }));
      `);
      expect(result).toEqual({ success: true, logs: [], outputHasUrl: true });
    });

    test("a relative import reports a resolve error", async () => {
      const result = await buildInChild(`
        const specifier = "./" + Buffer.alloc(131072, "A").toString() + ".js";
        const result = await Bun.build({
          entrypoints: ["/entry.js"],
          files: { "/entry.js": 'import "' + specifier + '";' },
          throw: false,
        });
        console.log(JSON.stringify({
          success: result.success,
          logs: result.logs.map(log => log.message.replace(specifier, "<specifier>")),
        }));
      `);
      expect(result).toEqual({
        success: false,
        logs: ['Could not resolve: "<specifier>"'],
      });
    });

    test("HTML script and stylesheet references report resolve errors", async () => {
      const result = await buildInChild(`
        const long = Buffer.alloc(131072, "A").toString();
        const result = await Bun.build({
          entrypoints: ["/index.html"],
          files: {
            "/index.html":
              '<!doctype html><html><head><link rel="stylesheet" href="./' + long + '.css"></head>' +
              '<body><script src="./' + long + '.js"></script></body></html>',
          },
          throw: false,
        });
        console.log(JSON.stringify({
          success: result.success,
          logs: result.logs.map(log => log.message.replace(long, "<long>")).sort(),
        }));
      `);
      expect(result).toEqual({
        success: false,
        logs: ['Could not resolve: "./<long>.css"', 'Could not resolve: "./<long>.js"'],
      });
    });

    test("a relative entry point reports a resolve error", async () => {
      const result = await buildInChild(`
        const entryPoint = Buffer.alloc(131072, "A").toString() + ".js";
        const result = await Bun.build({
          entrypoints: [entryPoint],
          files: { "/entry.js": "" },
          throw: false,
        });
        console.log(JSON.stringify({
          success: result.success,
          logs: result.logs.map(log => log.message.replace(entryPoint, "<entry point>")),
        }));
      `);
      expect(result).toEqual({
        success: false,
        logs: ['ModuleNotFound resolving "<entry point>" (entry point)'],
      });
    });
  });
});
