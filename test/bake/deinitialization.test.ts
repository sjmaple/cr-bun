import { expect, test } from "bun:test";
import { bunEnv, bunExe, tempDir } from "harness";
import path from "node:path";

test("dev server deinitializes itself", () => {
  const result = Bun.spawnSync({
    cmd: [bunExe(), "test", path.join(import.meta.dir, "fixtures/deinitialization/test.ts")],
    env: bunEnv,
    stdio: ["inherit", "inherit", "inherit"],
    cwd: path.join(import.meta.dir, "fixtures/deinitialization"),
  });
  expect(result.signalCode).toBeUndefined();
  expect(result.exitCode).toBe(0);
  // The child runs a whole `bun test` suite (nine GC-heavy cases plus leak
  // reporting at exit), which takes longer than the 5s default under ASAN.
}, 60_000);

test("dev server is deinitialized before its arena when listen fails", async () => {
  using dir = tempDir("dev-server-listen-fails", {
    "index.html": `<!DOCTYPE html><html><body></body></html>`,
    "listen-fails-fixture.ts": `
      import { getDevServerDeinitCount } from "bun:internal-for-testing";
      import html from "./index.html";

      const taken = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: () => new Response("taken") });
      const deinitsBefore = getDevServerDeinitCount();
      let code = "listen succeeded";
      try {
        Bun.serve({ development: true, hostname: "127.0.0.1", port: taken.port, routes: { "/": html } }).stop(true);
      } catch (e) {
        code = e.code;
      }
      const deinits = getDevServerDeinitCount() - deinitsBefore;
      taken.stop(true);
      console.log(JSON.stringify({ code, deinits }));
    `,
  });

  await using proc = Bun.spawn({
    cmd: [bunExe(), "listen-fails-fixture.ts"],
    // A read of a freed arena then faults in debug builds instead of seeing stale bytes.
    env: { ...bunEnv, MIMALLOC_PURGE_DELAY: "0" },
    cwd: String(dir),
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, exitCode] = await Promise.all([proc.stdout.text(), proc.stderr.text(), proc.exited]);

  expect(stderr).toBe("");
  expect(stdout).toBe('{"code":"EADDRINUSE","deinits":1}\n');
  expect(exitCode).toBe(0);
});

// The first request for a route waits for the bundle of that route. Its body
// crosses maxRequestBodySize while it waits: the server answers 413 and the
// request is over. The wait used to keep the response of that request, and
// wrote the error page of a failed bundle to it after the connection was freed.
test.each([
  { route: `export default () => new Response("page");`, next: 200 },
  { route: `export default () => new Response("page" ;;; ))`, next: 500 },
])("a request that waits for a bundle and crosses maxRequestBodySize is released: $next", async ({ route, next }) => {
  using dir = tempDir("dev-server-deferred-limit", {
    "server.ts": `export function render(req: Request, meta: any) { return meta.pageModule.default(req, meta); }`,
    "routes/index.ts": route,
    "fixture.ts": `
      import net from "node:net";

      const fsr = { root: "routes", style: "nextjs-pages", serverEntryPoint: "./server.ts" };
      const server = Bun.serve({
        port: 0,
        hostname: "127.0.0.1",
        maxRequestBodySize: 32,
        development: true,
        app: { framework: { fileSystemRouterTypes: [fsr] } },
      });

      const upload = await new Promise(resolve => {
        const chunks = [];
        const sock = net.connect(server.port, "127.0.0.1", () => {
          const head = "POST / HTTP/1.1\\r\\nHost: 127.0.0.1\\r\\nTransfer-Encoding: chunked\\r\\n\\r\\n";
          sock.end(head + "30\\r\\n" + Buffer.alloc(48, "x") + "\\r\\n");
        });
        sock.on("data", d => chunks.push(d));
        sock.on("error", () => {});
        sock.on("close", () => resolve(Buffer.concat(chunks).toString("latin1").split("\\r\\n")[0]));
      });
      // The bundle is done when the route answers.
      const next = (await fetch(server.url)).status;
      // A request that is never released shows in the result.
      const deadline = Date.now() + 2000;
      while (server.pendingRequests > 0 && Date.now() < deadline) await new Promise(resolve => setImmediate(resolve));
      console.log(JSON.stringify({ upload, next, pendingRequests: server.pendingRequests }));
      server.stop(true);
    `,
  });

  await using proc = Bun.spawn({
    cmd: [bunExe(), "fixture.ts"],
    env: bunEnv,
    cwd: String(dir),
    stdout: "pipe",
    // The bundler reports the route here: how long it took, or its syntax error.
    stderr: "ignore",
  });
  const [stdout, exitCode] = await Promise.all([proc.stdout.text(), proc.exited]);

  expect(stdout).toBe(`${JSON.stringify({ upload: "HTTP/1.1 413 Payload Too Large", next, pendingRequests: 0 })}\n`);
  expect(exitCode).toBe(0);
});
