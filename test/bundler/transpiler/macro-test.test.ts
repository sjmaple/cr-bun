import { escapeHTML } from "bun" with { type: "macro" };
import { describe, expect, test } from "bun:test";
import { bunEnv, bunExe, tempDir } from "harness";
import { existsSync } from "node:fs";
import path from "node:path";
import defaultMacro, {
  addStrings,
  addStringsUTF16,
  default as defaultMacroAlias,
  escape,
  identity,
  identity as identity1,
  identity as identity2,
  ireturnapromise,
  symbolKeys,
} from "./macro.ts" with { type: "macro" };

import * as macros from "./macro.ts" with { type: "macro" };

test("bun builtins can be used in macros", async () => {
  expect(escapeHTML("abc!")).toBe("abc!");
});

test("latin1 string", () => {
  expect(identity("©")).toBe("©");
});

test("ascii string", () => {
  expect(identity("abc")).toBe("abc");
});

test("type coercion", () => {
  expect(identity({ a: 1 })).toEqual({ a: 1 });
  expect(identity([1, 2, 3])).toEqual([1, 2, 3]);
  expect(identity(undefined)).toBe(undefined);
  expect(identity(null)).toBe(null);
  expect(identity(1.5)).toBe(1.5);
  expect(identity(1)).toBe(1);
  expect(identity(true)).toBe(true);
});

// A Symbol key has no source form. The inlined object keeps the string keys
// only, like JSON.stringify, instead of a string key named by the description.
test("object with Symbol keys", () => {
  const value = symbolKeys();
  expect(value).toEqual({ v: 2 });
  expect(Reflect.ownKeys(value)).toEqual(["v"]);
});

test("escaping", () => {
  expect(identity("\\")).toBe("\\");
  expect(identity("\f")).toBe("\f");
  expect(identity("\n")).toBe("\n");
  expect(identity("\r")).toBe("\r");
  expect(identity("\t")).toBe("\t");
  expect(identity("\v")).toBe("\v");
  expect(identity("\0")).toBe("\0");
  expect(identity("'")).toBe("'");
  expect(identity('"')).toBe('"');
  expect(identity("`")).toBe("`");
  // prettier-ignore
  expect(identity("\'")).toBe("\'");
  // prettier-ignore
  expect(identity('\"')).toBe('\"');
  // prettier-ignore
  expect(identity("\`")).toBe("\`");
  expect(identity("$")).toBe("$");
  expect(identity("\x00")).toBe("\x00");
  expect(identity("\x0B")).toBe("\x0B");
  expect(identity("\x0C")).toBe("\x0C");

  expect(identity("\\")).toBe("\\");

  expect(escape()).toBe("\\\f\n\r\t\v\0'\"`$\x00\x0B\x0C");

  expect(addStrings("abc")).toBe("abc\\\f\n\r\t\v\0'\"`$\x00\x0B\x0C©");
  expect(addStrings("\n")).toBe("\n\\\f\n\r\t\v\0'\"`$\x00\x0B\x0C©");
  expect(addStrings("\r")).toBe("\r\\\f\n\r\t\v\0'\"`$\x00\x0B\x0C©");
  expect(addStrings("\t")).toBe("\t\\\f\n\r\t\v\0'\"`$\x00\x0B\x0C©");
  expect(addStrings("©")).toBe("©\\\f\n\r\t\v\0'\"`$\x00\x0B\x0C©");
  expect(addStrings("\x00")).toBe("\x00\\\f\n\r\t\v\0'\"`$\x00\x0B\x0C©");
  expect(addStrings("\x0B")).toBe("\x0B\\\f\n\r\t\v\0'\"`$\x00\x0B\x0C©");
  expect(addStrings("\x0C")).toBe("\x0C\\\f\n\r\t\v\0'\"`$\x00\x0B\x0C©");
  expect(addStrings("\\")).toBe("\\\\\f\n\r\t\v\0'\"`$\x00\x0B\x0C©");
  expect(addStrings("\f")).toBe("\f\\\f\n\r\t\v\0'\"`$\x00\x0B\x0C©");
  expect(addStrings("\v")).toBe("\v\\\f\n\r\t\v\0'\"`$\x00\x0B\x0C©");
  expect(addStrings("\0")).toBe("\0\\\f\n\r\t\v\0'\"`$\x00\x0B\x0C©");
  expect(addStrings("'")).toBe("'\\\f\n\r\t\v\0'\"`$\x00\x0B\x0C©");
  expect(addStrings('"')).toBe('"\\\f\n\r\t\v\0\'"`$\x00\x0B\x0C©');
  expect(addStrings("`")).toBe("`\\\f\n\r\t\v\0'\"`$\x00\x0B\x0C©");
  expect(addStrings("😊")).toBe("😊\\\f\n\r\t\v\0'\"`$\x00\x0B\x0C©");

  expect(addStringsUTF16("abc")).toBe("abc\\\f\n\r\t\v\0'\"`$\x00\x0B\x0C😊");
  expect(addStringsUTF16("\n")).toBe("\n\\\f\n\r\t\v\0'\"`$\x00\x0B\x0C😊");
  expect(addStringsUTF16("\r")).toBe("\r\\\f\n\r\t\v\0'\"`$\x00\x0B\x0C😊");
  expect(addStringsUTF16("\t")).toBe("\t\\\f\n\r\t\v\0'\"`$\x00\x0B\x0C😊");
  expect(addStringsUTF16("©")).toBe("©\\\f\n\r\t\v\0'\"`$\x00\x0B\x0C😊");
  expect(addStringsUTF16("\x00")).toBe("\x00\\\f\n\r\t\v\0'\"`$\x00\x0B\x0C😊");
  expect(addStringsUTF16("\x0B")).toBe("\x0B\\\f\n\r\t\v\0'\"`$\x00\x0B\x0C😊");
  expect(addStringsUTF16("\x0C")).toBe("\x0C\\\f\n\r\t\v\0'\"`$\x00\x0B\x0C😊");
  expect(addStringsUTF16("\\")).toBe("\\\\\f\n\r\t\v\0'\"`$\x00\x0B\x0C😊");
  expect(addStringsUTF16("\f")).toBe("\f\\\f\n\r\t\v\0'\"`$\x00\x0B\x0C😊");
  expect(addStringsUTF16("\v")).toBe("\v\\\f\n\r\t\v\0'\"`$\x00\x0B\x0C😊");
  expect(addStringsUTF16("\0")).toBe("\0\\\f\n\r\t\v\0'\"`$\x00\x0B\x0C😊");
  expect(addStringsUTF16("'")).toBe("'\\\f\n\r\t\v\0'\"`$\x00\x0B\x0C😊");
  expect(addStringsUTF16('"')).toBe('"\\\f\n\r\t\v\0\'"`$\x00\x0B\x0C😊');
  expect(addStringsUTF16("`")).toBe("`\\\f\n\r\t\v\0'\"`$\x00\x0B\x0C😊");
  expect(addStringsUTF16("😊")).toBe("😊\\\f\n\r\t\v\0'\"`$\x00\x0B\x0C😊");
});

test("utf16 string", () => {
  expect(identity("😊 Smiling Face with Smiling Eyes Emoji")).toBe("😊 Smiling Face with Smiling Eyes Emoji");
});

test("import aliases", () => {
  expect(identity1({ a: 1 })).toEqual({ a: 1 });
  expect(identity1([1, 2, 3])).toEqual([1, 2, 3]);
  expect(identity2({ a: 1 })).toEqual({ a: 1 });
  expect(identity2([1, 2, 3])).toEqual([1, 2, 3]);
});

test("default import", () => {
  expect(defaultMacro()).toBe("defaultdefaultdefault");
  expect(defaultMacroAlias()).toBe("defaultdefaultdefault");
});

test("namespace import", () => {
  expect(macros.identity({ a: 1 })).toEqual({ a: 1 });
  expect(macros.identity([1, 2, 3])).toEqual([1, 2, 3]);
  expect(macros.escape()).toBe("\\\f\n\r\t\v\0'\"`$\x00\x0B\x0C");
});

// test("template string ascii", () => {
//   expect(identity(`A${""}`)).toBe("A");
// });

// test("template string latin1", () => {
//   expect(identity(`©${""}`)).toBe("©");
// });

test("ireturnapromise", async () => {
  expect(await ireturnapromise()).toEqual("aaa");
});

// This file used `assert` for its own imports until TypeScript 7 made that a syntax error (TS2880).
test("the `assert { type: 'macro' }` spelling works for every form of import", async () => {
  using dir = tempDir("macro-import-assertion", {
    "macro.ts": `export function identity(arg: any) {\n  return arg;\n}\nexport default function () {\n  return "default";\n}\n`,
    "index.ts": `
      import { escapeHTML } from "bun" assert { type: "macro" };
      import defaultMacro, { identity, identity as alias, default as defaultAlias } from "./macro.ts" assert { type: "macro" };
      import * as macros from "./macro.ts" assert { type: "macro" };
      console.log(JSON.stringify([escapeHTML("<a>"), defaultMacro(), identity(1), alias(2), defaultAlias(), macros.identity(3)]));
    `,
  });
  await using proc = Bun.spawn({
    cmd: [bunExe(), "build", "--no-bundle", "index.ts"],
    env: bunEnv,
    cwd: String(dir),
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, exitCode] = await Promise.all([proc.stdout.text(), proc.stderr.text(), proc.exited]);
  // Every call is replaced by its result, so the macros ran at transpile time. Debug builds print
  // "[macro] call identity" to stdout first, so only the tail of stdout is matched.
  expect({ stdout: stdout.trim(), stderr, exitCode }).toMatchObject({
    stdout: expect.stringMatching(
      /console\.log\(JSON\.stringify\(\["&lt;a&gt;", "default", 1, 2, "default", 3\]\)\);$/,
    ),
    exitCode: 0,
  });
});

// A numeric key >= 100000 (JSC's MIN_SPARSE_ARRAY_INDEX) makes the property put inside
// JSC__JSValue__putToPropertyKey take a path that can throw, so the binding must check for
// an exception. BUN_JSC_validateExceptionChecks=1 aborts the child if the check is missing.
test("object argument with a sparse numeric key", async () => {
  using dir = tempDir("macro-sparse-key", {
    "take.ts": `export function take(o: any) {\n  return Object.keys(o).join(",");\n}\n`,
    "index.ts": `import { take } from "./take.ts" with { type: "macro" };\nconsole.log(take({ 200000: 1 }));\n`,
  });
  await using proc = Bun.spawn({
    cmd: [bunExe(), "run", "index.ts"],
    env: { ...bunEnv, BUN_JSC_validateExceptionChecks: "1" },
    cwd: String(dir),
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, exitCode] = await Promise.all([proc.stdout.text(), proc.stderr.text(), proc.exited]);
  // One combined assertion so stderr (where JSC prints the exception check failure) shows up in
  // the diff if the child aborts. Debug builds print "[macro] call take" to stdout before the
  // script's own output, so only the tail of stdout is matched.
  expect({ stdout, stderr, exitCode, signalCode: proc.signalCode }).toMatchObject({
    stdout: expect.stringMatching(/200000\n$/),
    exitCode: 0,
    signalCode: null,
  });
});

test("object destructuring of a macro result keeps every bound property regardless of key order or repeated keys", async () => {
  using dir = tempDir("macro-destructure-object", {
    "m.ts": `export function m() {\n  return { a: 1, c: 2 };\n}\n`,
    "index.ts": [
      `import { m } from "./m.ts" with { type: "macro" };`,
      `const { c, a } = m();`,
      `const { a: x, a: y, c: z } = m();`,
      `console.log(JSON.stringify([c, a, x, y, z]));`,
      ``,
    ].join("\n"),
  });
  await using proc = Bun.spawn({
    cmd: [bunExe(), "run", "index.ts"],
    env: bunEnv,
    cwd: String(dir),
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, exitCode] = await Promise.all([proc.stdout.text(), proc.stderr.text(), proc.exited]);
  expect({ lastLine: stdout.trim().split("\n").pop(), stderr }).toEqual({ lastLine: "[2,1,1,1,2]", stderr: "" });
  expect(exitCode).toBe(0);
});

// A Response or Blob returned from a macro is inlined by its content type: JSON is parsed into an object
// literal, text becomes a string, anything else becomes a base64 data URL. The type has to be classified
// with its parameters stripped: `Response.json()` and most servers send `application/json;charset=utf-8`.
test("a macro that returns a JSON or text Response or Blob is inlined by its content type", async () => {
  await using server = Bun.serve({ port: 0, fetch: () => Response.json({ from: "server" }) });
  using dir = tempDir("macro-response-content-type", {
    "m.ts": [
      `export function json() {`,
      `  return Response.json({ a: 1, b: [true, null, "x"] });`,
      `}`,
      `export function jsonHeader() {`,
      `  return new Response('{"b":2}', { headers: { "content-type": "application/json" } });`,
      `}`,
      `export function fetched() {`,
      `  return fetch(process.env.MACRO_TEST_URL!);`,
      `}`,
      `export function text() {`,
      `  return new Response("hello", { headers: { "content-type": "text/plain; charset=utf-8" } });`,
      `}`,
      `export function blobJson() {`,
      `  return new Blob(['{"c":3}'], { type: "application/json; charset=utf-8" });`,
      `}`,
      `export function binary() {`,
      `  return new Response(new Uint8Array([1, 2, 3]), { headers: { "content-type": "application/octet-stream" } });`,
      `}`,
    ].join("\n"),
    "index.ts": [
      `import { json, jsonHeader, fetched, text, blobJson, binary } from "./m.ts" with { type: "macro" };`,
      `console.log(JSON.stringify([json(), jsonHeader(), fetched(), text(), blobJson(), binary()]));`,
      ``,
    ].join("\n"),
  });
  await using proc = Bun.spawn({
    cmd: [bunExe(), "run", "index.ts"],
    env: { ...bunEnv, MACRO_TEST_URL: server.url.href },
    cwd: String(dir),
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, exitCode] = await Promise.all([proc.stdout.text(), proc.stderr.text(), proc.exited]);
  // Debug builds print "[macro] call <name>" to stdout before the script's own output.
  expect({ lastLine: stdout.trim().split("\n").pop(), stderr }).toEqual({
    lastLine: JSON.stringify([
      { a: 1, b: [true, null, "x"] },
      { b: 2 },
      { from: "server" },
      "hello",
      { c: 3 },
      "data:application/octet-stream;base64,AQID",
    ]),
    stderr: "",
  });
  expect(exitCode).toBe(0);
});

// The classification follows the MIME essence, not the category table the runtime uses for blob types:
// any `+json` suffix or `/json` subtype is JSON, and the JavaScript and XML `application/*` types are text.
// The data URL keeps the raw content type, parameters included.
test("a Response or Blob returned from a macro is classified by its MIME essence", async () => {
  const json = '{"a":1}';
  const cases: [type: string, body: string, expected: unknown][] = [
    ["application/json", json, { a: 1 }],
    ["application/json; charset=utf-8", json, { a: 1 }],
    ["application/vnd.api+json", json, { a: 1 }],
    ["application/ld+json", json, { a: 1 }],
    ["application/ld+json; charset=utf-8", json, { a: 1 }],
    ["application/manifest+json", json, { a: 1 }],
    ["application/geo+json", json, { a: 1 }],
    ["text/json", json, { a: 1 }],
    ["application/javascript", "1+1", "1+1"],
    ["application/javascript; charset=utf-8", "1+1", "1+1"],
    ["application/x-javascript", "1+1", "1+1"],
    ["application/ecmascript", "1+1", "1+1"],
    ["application/xml", "<a/>", "<a/>"],
    ["text/plain", "hi", "hi"],
    ["text/html", "<b>hi</b>", "<b>hi</b>"],
    ["text/javascript", "1+1", "1+1"],
    ["text/xml", "<a/>", "<a/>"],
    ["image/png", "png", "data:image/png;base64,cG5n"],
    ["application/octet-stream", "bin", "data:application/octet-stream;base64,Ymlu"],
    ["application/wasm", "wasm", "data:application/wasm;base64,d2FzbQ=="],
    ["application/x-ndjson", '{"a":1}\n{"a":2}\n', "data:application/x-ndjson;base64,eyJhIjoxfQp7ImEiOjJ9Cg=="],
  ];
  using dir = tempDir("macro-mime-essence", {
    "m.ts": [
      `export function resp(type: string, body: string) {`,
      `  return new Response(body, { headers: { "content-type": type } });`,
      `}`,
      `export function blob(type: string, body: string) {`,
      `  return new Blob([body], { type });`,
      `}`,
    ].join("\n"),
    "index.ts": [
      `import { resp, blob } from "./m.ts" with { type: "macro" };`,
      `console.log(JSON.stringify([`,
      ...cases.map(([type, body]) => `  resp(${JSON.stringify(type)}, ${JSON.stringify(body)}),`),
      ...cases.map(([type, body]) => `  blob(${JSON.stringify(type)}, ${JSON.stringify(body)}),`),
      `]));`,
      ``,
    ].join("\n"),
  });
  await using proc = Bun.spawn({
    cmd: [bunExe(), "run", "index.ts"],
    env: bunEnv,
    cwd: String(dir),
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, exitCode] = await Promise.all([proc.stdout.text(), proc.stderr.text(), proc.exited]);
  const expected = cases.map(([, , expected]) => expected);
  // Debug builds print "[macro] call <name>" to stdout before the script's own output.
  expect({ lastLine: stdout.trim().split("\n").pop(), stderr }).toEqual({
    lastLine: JSON.stringify([...expected, ...expected]),
    stderr: "",
  });
  expect(exitCode).toBe(0);
});

// A macro's `await` is serviced by the VM's macro event loop, so completions have to be routed by which
// loop was current when their work started: what the macro started goes to the macro loop (or the wait
// hangs), what the program started stays on the regular loop (or program callbacks run mid-transpile),
// and whatever a macro started but did not await is adopted by the regular loop once the macro returns
// (or it is stranded and its keep-alive holds the process open). These run the macro in the main VM:
// the entry file's macros, or a module require()d so it transpiles on the main thread.
describe("event loop routing around macros", () => {
  async function run(files: Record<string, string>, env: Record<string, string> = {}) {
    using dir = tempDir("macro-loops", files);
    await using proc = Bun.spawn({
      cmd: [bunExe(), "run", "index.ts"],
      env: { ...bunEnv, ...env },
      cwd: String(dir),
      stdout: "pipe",
      stderr: "pipe",
    });
    const [stdout, stderr, exitCode] = await Promise.all([proc.stdout.text(), proc.stderr.text(), proc.exited]);
    // Debug builds also print "[macro] call <name>" to stdout.
    const lines = stdout
      .trim()
      .split("\n")
      .filter(line => !line.startsWith("[macro]"));
    return { lines, stderr, exitCode };
  }

  const unawaited: [name: string, macroSource: string][] = [
    [
      "an fs.promises call inside the macro",
      [
        `import { promises as fs } from "node:fs";`,
        `export function m() {`,
        `  fs.stat(import.meta.dir).then(() => console.log("settled"));`,
        `  return 1;`,
        `}`,
      ].join("\n"),
    ],
    [
      "an fs.promises call at the macro module's top level",
      [
        `import { promises as fs } from "node:fs";`,
        `fs.stat(import.meta.dir).then(() => console.log("settled"));`,
        `export function m() {`,
        `  return 1;`,
        `}`,
      ].join("\n"),
    ],
    [
      "a fetch() inside the macro",
      [
        `export function m() {`,
        `  fetch(process.env.MACRO_TEST_URL!).then(res => res.text()).then(body => console.log(body));`,
        `  return 1;`,
        `}`,
      ].join("\n"),
    ],
    [
      // 64 bytes or more are hashed on the WebCrypto work queue; its reply and keep-alive release come
      // back through the pool task's ticket rather than a thread-pool job like the cases above.
      "a crypto.subtle.digest() inside the macro",
      [
        `export function m() {`,
        `  crypto.subtle.digest("SHA-256", new Uint8Array(4096)).then(() => console.log("settled"));`,
        `  return 1;`,
        `}`,
      ].join("\n"),
    ],
    [
      // JSC's DeferredWorkTimer: the keep-alive and the completion are registered against the loop
      // current at WebAssembly.compile() and delivered from a JSC helper thread.
      "a WebAssembly.compile() inside the macro",
      [
        `export function m() {`,
        `  WebAssembly.compile(new Uint8Array([0, 0x61, 0x73, 0x6d, 1, 0, 0, 0])).then(() => console.log("settled"));`,
        `  return 1;`,
        `}`,
      ].join("\n"),
    ],
  ];

  test.concurrent.each(unawaited)(
    "%s that it does not await still lets the process exit",
    async (_name, macroSource) => {
      await using server = Bun.serve({ port: 0, fetch: () => new Response("settled") });
      const { lines, stderr, exitCode } = await run(
        {
          "m.ts": macroSource,
          "index.ts": `import { m } from "./m.ts" with { type: "macro" };\nconsole.log("value", m());\n`,
        },
        { MACRO_TEST_URL: server.url.href },
      );
      // The continuation runs on the macro loop if the work finishes while the macro is still being waited
      // on and on the regular loop otherwise, so its position relative to the entry module's output varies.
      expect({ lines: lines.sort(), stderr }).toEqual({ lines: ["settled", "value 1"], stderr: "" });
      expect(exitCode).toBe(0);
    },
  );

  // The program's digest finishes (microseconds, on the work queue) while the macro is parked in its
  // 200 ms wait. Its callback belongs to the program: it must run after require() returns, not inside
  // the macro's wait underneath the transpiler, so the macro never sees "program" in the log.
  test.concurrent("a program completion that arrives during a macro waits for the macro to return", async () => {
    const { lines, stderr, exitCode } = await run({
      "m.ts": [
        `export async function probe() {`,
        `  await Bun.sleep(200);`,
        `  return JSON.stringify(globalThis.log);`,
        `}`,
      ].join("\n"),
      "with-macro.ts": `import { probe } from "./m.ts" with { type: "macro" };\nexport const seen = probe();\n`,
      "index.ts": [
        `globalThis.log = [];`,
        `const digest = crypto.subtle.digest("SHA-256", new Uint8Array(4096)).then(() => globalThis.log.push("program"));`,
        `const { seen } = require("./with-macro.ts");`,
        `globalThis.log.push("required");`,
        `await digest;`,
        `console.log(seen, JSON.stringify(globalThis.log));`,
      ].join("\n"),
    });
    expect({ lines, stderr }).toEqual({ lines: [`[] ["required","program"]`], stderr: "" });
    expect(exitCode).toBe(0);
  });

  // If a program callback did run mid-macro, work it started there would be routed to the macro loop and,
  // finishing after the macro returned, would need the regular loop to adopt it. Either way the chain
  // must complete and the process must exit.
  test.concurrent("work chained off a program completion across a macro completes", async () => {
    const { lines, stderr, exitCode } = await run({
      "m.ts": `export async function probe() {\n  await Bun.sleep(200);\n  return 1;\n}\n`,
      "with-macro.ts": `import { probe } from "./m.ts" with { type: "macro" };\nexport const value = probe();\n`,
      "index.ts": [
        `import { promises as fs } from "node:fs";`,
        `const chained = crypto.subtle`,
        `  .digest("SHA-256", new Uint8Array(4096))`,
        `  .then(() => fs.stat(import.meta.dir))`,
        `  .then(() => "chained");`,
        `const { value } = require("./with-macro.ts");`,
        `console.log(value, await chained);`,
      ].join("\n"),
    });
    expect({ lines, stderr }).toEqual({ lines: ["1 chained"], stderr: "" });
    expect(exitCode).toBe(0);
  });
});

// A module that is not the entry point is transpiled on a worker thread, where no VM exists yet. The
// macro VM created there has to take the CLI's transform options, or the macro module never sees
// `--define`.
test("a macro in a module transpiled off the main thread sees --define", async () => {
  using dir = tempDir("macro-off-thread-define", {
    "m.ts": `export function mode() {\n  return process.env.MODE ?? "none";\n}\n`,
    "lib.ts": `import { mode } from "./m.ts" with { type: "macro" };\nexport const x = mode();\n`,
    "index.ts": `import { x } from "./lib.ts";\nconsole.log(x);\n`,
  });
  await using proc = Bun.spawn({
    cmd: [bunExe(), "--define", 'process.env.MODE:"prod"', "index.ts"],
    env: bunEnv,
    cwd: String(dir),
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, exitCode] = await Promise.all([proc.stdout.text(), proc.stderr.text(), proc.exited]);
  expect({ lastLine: stdout.trim().split("\n").pop(), stderr }).toEqual({ lastLine: "prod", stderr: "" });
  expect(exitCode).toBe(0);
});

// `Bun.build()` parses on the process-wide worker pool. The macro VM a worker creates takes the
// options of the build that creates it and lives on after that build, so this runs in its own
// process: an earlier build in the same process would otherwise decide what the macro sees.
test("Bun.build() passes define and loader to the macro VM", async () => {
  using dir = tempDir("macro-build-api-options", {
    "entry.ts": `import { mode, banner } from "./macro.ts" with { type: "macro" };\nconsole.log(mode(), banner());\n`,
    "macro.ts": [
      `import banner_ from "./banner.dat";`,
      `export function mode() {\n  return process.env.MODE ?? "none";\n}`,
      `export function banner() {\n  return banner_;\n}`,
      ``,
    ].join("\n"),
    "banner.dat": "hello from a text loader",
    "build.ts": `
      const result = await Bun.build({
        entrypoints: ["./entry.ts"],
        target: "bun",
        define: { "process.env.MODE": '"prod"' },
        loader: { ".dat": "text" },
      });
      console.log(await result.outputs[0].text());
    `,
  });
  await using proc = Bun.spawn({
    cmd: [bunExe(), "run", "build.ts"],
    env: bunEnv,
    cwd: String(dir),
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, exitCode] = await Promise.all([proc.stdout.text(), proc.stderr.text(), proc.exited]);
  expect({ lastLine: stdout.trim().split("\n").pop(), stderr }).toEqual({
    lastLine: `console.log("prod", "hello from a text loader");`,
    stderr: "",
  });
  expect(exitCode).toBe(0);
});

describe("--no-macros", () => {
  const files = {
    "macro.ts": `
      import { writeFileSync } from "node:fs";
      export function f() {
        writeFileSync("MACRO_RAN", "macro executed");
        return "INLINED_RESULT";
      }
    `,
    "entry.ts": `
      import { f } from "./macro.ts" with { type: "macro" };
      console.log(f());
    `,
  };

  test("bun build --no-macros refuses to run macros", async () => {
    using dir = tempDir("bundler-no-macros-cli", files);
    await using proc = Bun.spawn({
      cmd: [bunExe(), "build", "--no-macros", "./entry.ts", "--outdir", "dist"],
      env: bunEnv,
      cwd: String(dir),
      stdout: "pipe",
      stderr: "pipe",
    });
    const [stdout, stderr, exitCode] = await Promise.all([proc.stdout.text(), proc.stderr.text(), proc.exited]);
    expect({ stdout, stderr, exitCode }).toMatchObject({
      stderr: expect.stringContaining("Macros are disabled"),
      exitCode: 1,
    });
    expect(existsSync(path.join(String(dir), "MACRO_RAN"))).toBe(false);
    expect(existsSync(path.join(String(dir), "dist", "entry.js"))).toBe(false);
  });

  test("Bun.build({ macros: false }) refuses to run macros", async () => {
    using dir = tempDir("bundler-no-macros-api", {
      ...files,
      "build.ts": `
        const result = await Bun.build({
          entrypoints: ["./entry.ts"],
          outdir: "./dist",
          macros: false,
          throw: false,
        });
        console.log(JSON.stringify({
          success: result.success,
          logs: result.logs.map(l => l.message),
        }));
      `,
    });
    await using proc = Bun.spawn({
      cmd: [bunExe(), "run", "build.ts"],
      env: bunEnv,
      cwd: String(dir),
      stdout: "pipe",
      stderr: "pipe",
    });
    const [stdout, stderr, exitCode] = await Promise.all([proc.stdout.text(), proc.stderr.text(), proc.exited]);
    const parsed = JSON.parse(stdout.trim().split("\n").pop()!);
    expect({ parsed, stderr, exitCode }).toMatchObject({
      parsed: {
        success: false,
        logs: expect.arrayContaining([expect.stringContaining("Macros are disabled")]),
      },
      exitCode: 0,
    });
    expect(existsSync(path.join(String(dir), "MACRO_RAN"))).toBe(false);
  });

  test("bun build without --no-macros still runs macros", async () => {
    using dir = tempDir("bundler-macros-enabled", files);
    await using proc = Bun.spawn({
      cmd: [bunExe(), "build", "./entry.ts", "--outdir", "dist"],
      env: bunEnv,
      cwd: String(dir),
      stdout: "pipe",
      stderr: "pipe",
    });
    const [stdout, stderr, exitCode] = await Promise.all([proc.stdout.text(), proc.stderr.text(), proc.exited]);
    expect({ stdout, stderr, exitCode }).toMatchObject({ exitCode: 0 });
    const out = await Bun.file(path.join(String(dir), "dist", "entry.js")).text();
    expect(out).toContain("INLINED_RESULT");
    expect(existsSync(path.join(String(dir), "MACRO_RAN"))).toBe(true);
  });
});

// Bun removes a macro import from the output and replaces only a call of it with the macro's result. Any other
// reference would name a binding that the output does not declare, so it is an error wherever the file is transpiled.
describe("a macro import that is used outside of a call", () => {
  const notDefined = (name: string) => `"${name}" is a macro import and is not defined at runtime`;
  // Where no identifier is left to point at: the error is at the import.
  const notDefinedInFile = (name: string) => `${notDefined(name)}, but this file uses it outside of a call`;
  const removed = (name: string) => `Bun removes this macro import of "${name}" from "./m.ts"`;
  const remedy = (name: string, how = "add a regular import of it") =>
    `Bun replaces each call of a macro with its result. To inline a value, call a macro that returns it. To use "${name}" at runtime, ${how}.`;

  const macroFile = [
    `export function m(x?: unknown) { return 42; }`,
    `export function o() { return { a: 1, b: 2 }; }`,
    `export default function d() { return 7; }`,
    `export const K = [1, 2, 3].join(",");`,
    ``,
  ].join("\n");
  const named = `import { m } from "./m.ts" with { type: "macro" };`;
  const star = `import * as ns from "./m.ts" with { type: "macro" };`;

  // Each of these names the macro import `USE` once, on the line after the import. The error is at that identifier.
  const importOfUse = `import { m as USE } from "./m.ts" with { type: "macro" };\n`;
  const uses: Record<string, string> = {
    "alias.ts": `const f = USE;`,
    "call-argument.ts": `console.log(USE);`,
    "new-argument.ts": `new Set(USE);`,
    "new-target.ts": `new USE();`,
    "member.ts": `console.log(USE.name);`,
    "index.ts": `console.log(USE["name"]);`,
    "index-key.ts": `console.log([1][USE]);`,
    "optional-member.ts": `console.log(USE?.name);`,
    "method-call.ts": `USE.call(null);`,
    "call-of-call.ts": `console.log(USE.bind(null)()());`,
    "unary.ts": `console.log(!USE);`,
    "typeof.ts": `console.log(typeof USE);`,
    "binary-left.ts": `console.log(USE + 1);`,
    "binary-right.ts": `console.log(1 + USE);`,
    "logical.ts": `console.log(globalThis.x || USE);`,
    "comma.ts": `console.log((1, USE));`,
    "conditional-test.ts": `console.log(USE ? 1 : 2);`,
    "conditional-chain.ts": `console.log(globalThis.a ? 1 : globalThis.b ? 2 : USE);`,
    "assignment-target.ts": `USE = 1;`,
    "assignment-value.ts": `let x; x = USE;`,
    "update.ts": `USE++;`,
    "expression-statement.ts": `USE;`,
    "array.ts": `console.log([1, USE]);`,
    "spread.ts": `console.log([...USE]);`,
    "object-value.ts": `console.log({ a: USE });`,
    "object-shorthand.ts": `console.log({ USE });`,
    "object-computed-key.ts": `console.log({ [USE]: 1 });`,
    "object-spread.ts": `console.log({ ...USE });`,
    "object-method.ts": `console.log({ f() { return USE; } });`,
    "object-getter.ts": `console.log({ get f() { return USE; } });`,
    "template.ts": "console.log(`a${USE}b`);",
    "tagged-template.ts": "console.log(String.raw`a${USE}b`);",
    "satisfies.ts": `console.log(USE satisfies unknown);`,
    "non-null.ts": `console.log(USE!);`,
    "dynamic-import.ts": `import(USE);`,
    "arrow-body.ts": `export const f = () => USE;`,
    "arrow-block.ts": `export const f = () => { return USE; };`,
    "arrow-default.ts": `export const f = (a = USE) => a;`,
    "function-body.ts": `export function f() { return USE; }`,
    "function-default.ts": `export function f(a = USE) { return a; }`,
    "function-expression.ts": `export const f = function () { return USE; };`,
    "async.ts": `export async function f() { return await USE; }`,
    "generator.ts": `export function* f() { yield USE; }`,
    "destructuring-default.ts": `export const { a = USE } = {} as any;`,
    "array-destructuring-default.ts": `export const [a = USE] = [] as any;`,
    "destructuring-computed-key.ts": `export const { [USE]: a } = {} as any;`,
    "parameter-destructuring-default.ts": `export function f({ a = USE } = {} as any) { return a; }`,
    "class-extends.ts": `export class A extends USE {}`,
    "class-field.ts": `export class A { x = USE; }`,
    "class-static-field.ts": `export class A { static x = USE; }`,
    "class-private-field.ts": `export class A { #x = USE; get x() { return this.#x; } }`,
    "class-method.ts": `export class A { f() { return USE; } }`,
    "class-computed-key.ts": `export class A { [USE]() {} }`,
    "class-static-block.ts": `export class A { static { console.log(USE); } }`,
    "class-expression.ts": `export const A = class { x = USE; };`,
    "class-parameter-property.ts": `export class A { constructor(public x = USE) {} }`,
    "class-decorator.ts": `function dec(...a: any[]) { return (..._: any[]) => {}; } @dec(USE) class A {} console.log(A);`,
    "member-decorator.ts": `function dec(...a: any[]) { return (..._: any[]) => {}; } class A { @dec(USE) x = 1; } console.log(A);`,
    "if-test.ts": `if (USE) console.log(1);`,
    "else-if.ts": `if (globalThis.a) {} else if (globalThis.b) {} else if (USE) console.log(1);`,
    "if-body.ts": `if (globalThis.a) { console.log(USE); }`,
    "for-init.ts": `for (let i = USE; i < 1; i++) {}`,
    "for-test.ts": `for (let i = 0; i < USE; i++) {}`,
    "for-update.ts": `for (let i = 0; i < 1; i += USE) {}`,
    "for-body.ts": `for (let i = 0; i < 1; i++) { console.log(USE); }`,
    "for-in.ts": `for (const k in USE) {}`,
    "for-of.ts": `for (const k of USE) {}`,
    "for-of-target.ts": `for (USE of []) {}`,
    "while.ts": `while (USE) {}`,
    "do-while.ts": `do {} while (USE);`,
    "switch-test.ts": `switch (USE) {}`,
    "switch-case.ts": `switch (globalThis.a) { case USE: break; }`,
    "switch-body.ts": `switch (globalThis.a) { default: console.log(USE); }`,
    "try.ts": `try { console.log(USE); } catch {}`,
    "catch.ts": `try {} catch { console.log(USE); }`,
    "finally.ts": `try {} finally { console.log(USE); }`,
    "throw.ts": `throw USE;`,
    "label.ts": `a: { console.log(USE); }`,
    "block.ts": `{ console.log(USE); }`,
    "return.ts": `export function f() { if (globalThis.a) return USE; }`,
    "export-clause.ts": `export { USE };`,
    "export-clause-renamed.ts": `export { USE as other };`,
    "export-default.ts": `export default USE;`,
    "export-default-expression.ts": `export default [USE];`,
    "export-const.ts": `export const f = USE;`,
    "import-equals.ts": `import f = USE; console.log(f);`,
    "enum.ts": `enum E { A = USE as any } console.log(E.A);`,
    "namespace-block.ts": `namespace N { export const v = USE; } console.log(N.v);`,
    // As deep to the left as it is long.
    "long-chain.ts": `export const sum = USE${Buffer.alloc(2 * 20_000, "+x").toString()}; var x = 1;`,
  };

  // Every spelling of the import, and a reference beside a call. [source, ...the message of each error]
  const refused: Record<string, [source: string, ...errors: string[]]> = {
    "constant.ts": [`import { K } from "./m.ts" with { type: "macro" }; console.log(K);`, notDefined("K")],
    "default.ts": [`import d from "./m.ts" with { type: "macro" }; console.log(d);`, notDefined("d")],
    "renamed.ts": [
      `import { m as renamed } from "./m.ts" with { type: "macro" }; console.log(renamed);`,
      notDefined("renamed"),
    ],
    "assert.ts": [`import { m } from "./m.ts" assert { type: "macro" }; console.log(m);`, notDefined("m")],
    "prefix.ts": [`import { m } from "macro:./m.ts"; console.log(m);`, notDefined("m")],
    "namespace.ts": [`${star} console.log(Object.keys(ns));`, notDefined("ns")],
    "namespace-member.ts": [`${star} const f = ns.m; console.log(f());`, notDefined("ns")],
    "namespace-member-of-member.ts": [`${star} console.log(ns.m.call(null));`, notDefined("ns")],
    // A bundle counts a property of an import apart from the import.
    "property.ts": [`${named} console.log(m.name, m.call(null));`, notDefined("m"), notDefined("m")],
    // The linker used to panic on the property once the call beside it had removed the count of the import.
    "property-beside-call.ts": [`${named} console.log(m.name, m());`, notDefined("m")],
    "two-imports.ts": [`${named} ${star} console.log(m, ns);`, notDefined("m"), notDefined("ns")],
    // Where the minifier inlines `f`, the call it leaves is not one that the macro replaced.
    "function-alias.ts": [`${named} function g() { const f = m; return f("x"); } console.log(g());`, notDefined("m")],
    // A bundle does not keep this function, and it is still an error.
    "uncalled-function.ts": [`${named} function uncalled() { return m; } console.log("loaded");`, notDefined("m")],
    "typeof-guard.ts": [`${named} console.log(typeof m === "function" ? "fn" : m());`, notDefined("m")],
    // Dead code that the output keeps can still name a macro import. That alone is not an error.
    "dead-beside-live.ts": [
      `import { m, o } from "./m.ts" with { type: "macro" }; if (false) { switch (o) {} } console.log(m);`,
      notDefined("m"),
    ],
    // A replaced call, live or dead, does not hide a use in another place.
    "beside-calls.ts": [
      `import fn, { m as renamed } from "./m.ts" with { type: "macro" }; ${star} export function later() { return [renamed(), ns.m()].map(renamed); } if (false) { console.log(fn()); } export { fn }; console.log(typeof ns, fn());`,
      notDefined("renamed"),
      notDefined("fn"),
      notDefined("ns"),
    ],
    // The visit pass counts a use before it removes the node that holds it. The count decides.
    "removed-node.ts": [`${named} export function g() { void m; }`, notDefinedInFile("m")],
    // The walk that finds the identifier stops at a depth limit. The error does not depend on it.
    "deep.ts": [
      `${named} console.log(${Buffer.alloc(600, "[").toString()}m${Buffer.alloc(600, "]").toString()});`,
      notDefinedInFile("m"),
    ],
  };

  // The error follows what the visit pass replaces and removes, and that depends on how the file is transpiled.
  const folded: Record<string, { source: string; build: string[]; import: string[]; transform: string[] }> = {
    // A call of `m` once the comma is folded away. The runtime folds it before it looks at the call.
    "comma-call.ts": {
      source: `${named} console.log("comma-call", (0, m)());`,
      build: [notDefined("m")],
      import: [],
      transform: [notDefined("m")],
    },
    // A statement with no effect is removed, and its use with it where each statement is a part of its own.
    "void-statement.ts": {
      source: `${named} void m; console.log("void-statement", m());`,
      build: [],
      import: [],
      transform: [notDefinedInFile("m")],
    },
  };

  // Each line of this file prints one line, and keeps doing so.
  const accepted: [statement: string, stdout: string][] = [
    [`import d, { m, m as renamed, o } from "./m.ts" with { type: "macro" };`, ""],
    [`import * as ns from "./m.ts" with { type: "macro" };`, ""],
    [`import { m as asserted } from "./m.ts" assert { type: "macro" };`, ""],
    [`import { m as prefixed } from "macro:./m.ts";`, ""],
    [`import { m as unused } from "./m.ts" with { type: "macro" };`, ""],
    [`import * as unusedNamespace from "./m.ts" with { type: "macro" };`, ""],
    [`console.log("call", m());`, "call 42"],
    [`console.log("optional-call", m?.());`, "optional-call 42"],
    [`console.log("parenthesized-call", (m)());`, "parenthesized-call 42"],
    [
      `console.log("type-assertions", (m as any)(), m!(), (<any>m)(), (m satisfies unknown)());`,
      "type-assertions 42 42 42 42",
    ],
    [`console.log("default-and-renamed", d(), renamed());`, "default-and-renamed 7 42"],
    [`console.log("assert-and-prefix", asserted(), prefixed());`, "assert-and-prefix 42 42"],
    [`console.log("namespace", ns.m(), ns?.m(), ns.default());`, "namespace 42 42 7"],
    [`console.log("use-before-import", late());`, "use-before-import 42"],
    [
      `type T = ReturnType<typeof m>; const typed: T = 1; let untyped: typeof m | undefined; console.log("type-only", typed, untyped);`,
      "type-only 1 undefined",
    ],
    [`const len = (m: string) => m.length; console.log("shadowed", len("abc"));`, "shadowed 3"],
    // A use in a branch that the visit pass knows is dead is not in the output.
    [`if (false) console.log(typeof m, m, ns); console.log("dead-branch");`, "dead-branch"],
    [`if (false) { console.log(m()); } false && m(); console.log("dead-call");`, "dead-call"],
    ['console.log("nested-calls", m(m()), [m(), m()].length, { a: m() }.a, `${m()}`);', "nested-calls 42 2 42 42"],
    [
      `class Fields { x = m(); static y = m(); #z = m(); get z() { return this.#z; } } console.log("class-fields", new Fields().x, Fields.y, new Fields().z);`,
      "class-fields 42 42 42",
    ],
    [
      `function withDefault(a = m()) { return a; } const arrowWithDefault = (a = m()) => a; console.log("default-parameters", withDefault(), arrowWithDefault());`,
      "default-parameters 42 42",
    ],
    [`const result = m(); const alias = result; console.log("result-alias", result + alias);`, "result-alias 84"],
    [
      `const { a, b } = o(); const [c] = [o().a]; console.log("destructured-result", a, b, c);`,
      "destructured-result 1 2 1",
    ],
    [`enum Enum { A = m(), B = A + 1 } console.log("enum", Enum.A, Enum.B);`, "enum 42 43"],
    [`namespace Block { export const v = m(); } console.log("namespace-block", Block.v);`, "namespace-block 42"],
    [`console.log("condition", m() ? "yes" : "no", m() && 1, m() ?? 2);`, "condition yes 1 42"],
    [`import { m as late } from "./m.ts" with { type: "macro" };`, ""],
  ];
  const acceptedStdout = accepted.map(([, stdout]) => stdout).filter(line => line !== "");

  // An error as [message, line, column, ...notes], and a note as [message, line, column].
  const errorsOf = `
    const at = (position: any) => [position?.line ?? null, position?.column ?? null];
    const errorsOf = (errors: any[]) =>
      errors.map(error => [
        error.message,
        ...at(error.position),
        ...(error.notes ?? []).map((note: any) => [note.message, ...at(note.position)]),
      ]);
  `;
  const inDirectory = (directory: string, sources: [file: string, source: string][]) =>
    Object.fromEntries([
      [`${directory}/m.ts`, macroFile],
      ...sources.map(([file, source]) => [`${directory}/${file}`, source + "\n"]),
    ]);
  const files = {
    "m.ts": macroFile,
    // The decorators in `uses` are TypeScript's. Bun.Transpiler reads no tsconfig.json and lowers them as standard ones.
    "tsconfig.json": JSON.stringify({ compilerOptions: { experimentalDecorators: true } }),
    ...inDirectory(
      "uses",
      Object.entries(uses).map(([file, source]) => [file, importOfUse + source]),
    ),
    ...inDirectory(
      "refused",
      Object.entries(refused).map(([file, [source]]) => [file, source]),
    ),
    ...inDirectory("accepted", [["accepted.ts", accepted.map(([statement]) => statement).join("\n")]]),
    ...inDirectory(
      "folded",
      Object.entries(folded).map(([file, { source }]) => [file, source]),
    ),
    // Prints, as its last line, the errors of each file in each directory.
    "errors.ts": `
      import { readdirSync } from "node:fs";
      import { basename } from "node:path";
      ${errorsOf}
      const [how, ...directories] = process.argv.slice(2);
      const transpiler = new Bun.Transpiler({ loader: "ts" });
      const all: Record<string, Record<string, unknown[]>> = {};
      for (const directory of directories) {
        const files = readdirSync(directory).filter(file => file !== "m.ts");
        const errors: Record<string, unknown[]> = Object.fromEntries(files.map(file => [file, []]));
        if (how === "build") {
          const entrypoints = files.map(file => "./" + directory + "/" + file);
          const build = await Bun.build({ entrypoints, target: "bun", throw: false });
          for (const log of build.logs) errors[basename(log.position?.file ?? "")]?.push(...errorsOf([log]));
        } else {
          for (const file of files) {
            const path = "./" + directory + "/" + file;
            try {
              if (how === "import") await import(path);
              else transpiler.transformSync(await Bun.file(path).text());
            } catch (e: any) {
              errors[file] = errorsOf(e?.errors ?? [e]);
            }
          }
        }
        all[directory] = errors;
      }
      console.log(JSON.stringify(all));
    `,
  };

  async function run(cwd: string, ...args: string[]) {
    await using proc = Bun.spawn({ cmd: [bunExe(), ...args], env: bunEnv, cwd, stdout: "pipe", stderr: "pipe" });
    const [stdout, stderr, exitCode] = await Promise.all([proc.stdout.text(), proc.stderr.text(), proc.exited]);
    // A debug build also prints "[macro] call <name>" to stdout.
    const lines = stdout
      .trim()
      .split("\n")
      .filter(line => !line.startsWith("[macro]"));
    return { lines, stderr, exitCode };
  }

  const usesErrors = Object.fromEntries(
    Object.entries(uses).map(([file, source]) => [
      file,
      [[notDefined("USE"), 2, source.indexOf("USE") + 1, [removed("USE"), 1, 10], [remedy("USE"), null, null]]],
    ]),
  );
  const refusedErrors = Object.fromEntries(Object.entries(refused).map(([file, [, ...errors]]) => [file, errors]));
  const messagesOf = (errors: Record<string, [message: string][]>) =>
    Object.fromEntries(Object.entries(errors).map(([file, errors]) => [file, errors.map(([message]) => message)]));

  // Bun.build(), the runtime and Bun.Transpiler each transpile with their own options.
  const ways = ["build", "import", "transform"];

  // Each of these six transpiles a directory of files, so they run one at a time.
  test.each(ways)("%s: each kind of reference is an error at its identifier", async how => {
    using dir = tempDir("macro-value-use", files);
    const { lines, stderr, exitCode } = await run(String(dir), "errors.ts", how, "uses");
    expect({ errors: JSON.parse(lines.at(-1)!).uses, stderr }).toEqual({ errors: usesErrors, stderr: "" });
    expect(exitCode).toBe(0);
  });

  test.each(ways)("%s: each spelling of the import is an error, and a call is not", async how => {
    using dir = tempDir("macro-value-use", files);
    const { lines, stderr, exitCode } = await run(String(dir), "errors.ts", how, "refused", "accepted", "folded");
    const errors = JSON.parse(lines.at(-1)!);
    expect({
      refused: messagesOf(errors.refused),
      accepted: errors.accepted,
      folded: messagesOf(errors.folded),
      printed: lines.slice(0, -1),
      stderr,
    }).toEqual({
      refused: refusedErrors,
      accepted: { "accepted.ts": [] },
      folded: Object.fromEntries(Object.entries(folded).map(([file, verdicts]) => [file, verdicts[how]])),
      // Only the import runs the files that have no error.
      printed: how === "import" ? [...acceptedStdout, "comma-call 42", "void-statement 42"] : [],
      stderr: "",
    });
    expect(exitCode).toBe(0);
  });

  test.concurrent("a bundle of the accepted forms runs", async () => {
    using dir = tempDir("macro-value-use", files);
    const build = await run(String(dir), "build", "./accepted/accepted.ts", "--target=bun", "--outdir", "out");
    expect({ stderr: build.stderr, exitCode: build.exitCode }).toEqual({ stderr: "", exitCode: 0 });
    const { lines, stderr, exitCode } = await run(String(dir), "out/accepted.js");
    expect({ lines, stderr }).toEqual({ lines: acceptedStdout, stderr: "" });
    expect(exitCode).toBe(0);
  });

  // With --no-macros a call of a macro is an error. Any other reference is still the name of a removed binding.
  test.concurrent("a reference that is not a call is an error with --no-macros too", async () => {
    using dir = tempDir("macro-value-use", {
      "m.ts": macroFile,
      "alias.ts": `${named} const f = m; console.log(f("x"));\n`,
    });
    const { stderr, exitCode } = await run(String(dir), "build", "--no-macros", "./alias.ts", "--target=bun");
    expect(stderr).toContain(notDefined("m"));
    expect(exitCode).toBe(1);
  });

  // A type that is named like a macro import is not a reference to it. The metadata of a decorated member names the
  // type, and a macro import has no value there.
  test.concurrent("a type named like a macro import is not an error with emitDecoratorMetadata", async () => {
    const body = (label: string) => [
      `const types: Record<string, unknown> = {};`,
      `(Reflect as any).metadata = (key: string, value: unknown) => (_: unknown, name: string) => {`,
      `  if (key === "design:type") types[name] = value;`,
      `};`,
      `function field(..._: unknown[]) {}`,
      `class Holder {`,
      `  @field plain: Settings = Settings();`,
      `  @field dotted!: ns.Settings;`,
      `}`,
      `console.log("${label}", JSON.stringify(new Holder().plain), types.plain === Object, types.dotted === Object);`,
    ];
    const imports = [
      `import { Settings } from "./settings.ts" with { type: "macro" };`,
      `import * as ns from "./settings.ts" with { type: "macro" };`,
    ];
    using dir = tempDir("macro-value-use", {
      "tsconfig.json": JSON.stringify({
        compilerOptions: { experimentalDecorators: true, emitDecoratorMetadata: true },
      }),
      "settings.ts": `export interface Settings { a: number }\nexport function Settings(): Settings { return { a: 1 }; }\n`,
      // The type is a macro import when the import comes first, and a name that is not bound yet when it comes last.
      "import-first.ts": [...imports, ...body("import-first"), ``].join("\n"),
      "type-first.ts": [...body("type-first"), ...imports, ``].join("\n"),
      "check.ts": `
        for (const file of ["./import-first.ts", "./type-first.ts"]) {
          await import(file);
          const build = await Bun.build({ entrypoints: [file], target: "bun", throw: false });
          const output = build.success ? await build.outputs[0].text() : build.logs.join("\\n");
          console.log(JSON.stringify(output.split("\\n").filter(line => line.includes('__legacyMetadataTS("design:type"'))));
        }
      `,
    });
    const { lines, stderr, exitCode } = await run(String(dir), "check.ts");
    const metadata = JSON.stringify([
      `  __legacyMetadataTS("design:type", Object)`,
      `  __legacyMetadataTS("design:type", Object)`,
    ]);
    expect({ lines, stderr }).toEqual({
      lines: [`import-first {"a":1} true true`, metadata, `type-first {"a":1} true true`, metadata],
      stderr: "",
    });
    expect(exitCode).toBe(0);
  });

  describe("an import that a macro remap replaces", () => {
    const remapped = {
      "bunfig.toml": `[macros]\nfakepkg = { "m" = "./m.ts", "default" = "./m.ts" }\n`,
      "m.ts": macroFile,
      "node_modules/fakepkg/package.json": JSON.stringify({ name: "fakepkg", version: "1.0.0", type: "module" }),
      "node_modules/fakepkg/index.js": [
        `export function m() { return "m at runtime"; }`,
        `export function other() { return "other at runtime"; }`,
        `export default function () { return "default at runtime"; }`,
        ``,
      ].join("\n"),
      "value.ts": `import { m, other } from "fakepkg";\nconst f = m;\nconsole.log(f, other());\n`,
      // Only the default import is a macro here. The namespace is still imported at runtime.
      "namespace.ts": `import d, * as ns from "fakepkg";\nconsole.log(d(), ns.other());\n`,
    };

    test.concurrent(
      "is an error when it is used outside of a call, and keeps a namespace import beside it",
      async () => {
        using dir = tempDir("macro-value-use", {
          ...remapped,
          "load.ts": `
          ${errorsOf}
          try {
            await import("./value.ts");
          } catch (e: any) {
            console.log(JSON.stringify(errorsOf(e?.errors ?? [e])));
          }
          await import("./namespace.ts");
        `,
        });
        const { lines, stderr, exitCode } = await run(String(dir), "load.ts");
        expect({ errors: JSON.parse(lines[0]), printed: lines.slice(1), stderr }).toEqual({
          errors: [
            [
              notDefined("m"),
              2,
              11,
              [`Bun removes this import of "m" because a macro remap replaces it with "./m.ts"`, 1, 10],
              [remedy("m", "remove its macro remap"), null, null],
            ],
          ],
          printed: ["7 other at runtime"],
          stderr: "",
        });
        expect(exitCode).toBe(0);
      },
    );

    // Bun.build() does not read the remaps of bunfig.toml, so this is the command.
    test.concurrent("keeps the namespace import in a bundle", async () => {
      using dir = tempDir("macro-value-use", remapped);
      const built = await run(String(dir), "build", "./namespace.ts", "--target=bun", "--outdir", "out");
      expect({ stderr: built.stderr, exitCode: built.exitCode }).toEqual({ stderr: "", exitCode: 0 });
      const { lines, stderr, exitCode } = await run(String(dir), "out/namespace.js");
      expect({ lines, stderr }).toEqual({ lines: ["7 other at runtime"], stderr: "" });
      expect(exitCode).toBe(0);
    });
  });

  // Inside a macro no call is replaced, so a module that a macro loads is not checked. What is transpiled there still
  // names the macro import, so a later load outside of a macro must not read it from the transpiler cache.
  test.concurrent(
    "a module that a macro loads is not checked, and is not cached for a load outside of a macro",
    async () => {
      using dir = tempDir("macro-value-use", {
        "m.ts": macroFile,
        "shared.ts": [
          named,
          `export function helper() { return "helper"; }`,
          `export function uncalled() { return m; }`,
          // Large enough for the transpiler cache to keep.
          `// ${Buffer.alloc(8 * 1024, "-").toString()}`,
          ``,
        ].join("\n"),
        "outer.ts": `import { helper } from "./shared.ts";\nexport function outer() { return helper(); }\n`,
        "inside.ts": `import { outer } from "./outer.ts" with { type: "macro" };\nconsole.log("inside", outer());\n`,
        "outside.ts": `import { helper } from "./shared.ts";\nconsole.log("outside", helper());\n`,
        "cache": {},
      });
      const env = {
        ...bunEnv,
        BUN_RUNTIME_TRANSPILER_CACHE_PATH: path.join(String(dir), "cache"),
        // A debug build reads the cache only with this.
        BUN_DEBUG_ENABLE_RESTORE_FROM_TRANSPILER_CACHE: "1",
      };
      for (const [file, expected] of [
        ["inside.ts", { lines: ["inside helper"], stderr: "", exitCode: 0 }],
        ["outside.ts", { lines: [""], stderr: expect.stringContaining(notDefined("m")), exitCode: 1 }],
      ] as const) {
        await using proc = Bun.spawn({ cmd: [bunExe(), file], env, cwd: String(dir), stdout: "pipe", stderr: "pipe" });
        const [stdout, stderr, exitCode] = await Promise.all([proc.stdout.text(), proc.stderr.text(), proc.exited]);
        const lines = stdout
          .trim()
          .split("\n")
          .filter(line => !line.startsWith("[macro]"));
        expect({ file, lines, stderr, exitCode }).toEqual({ file, ...expected });
      }
    },
  );
});
