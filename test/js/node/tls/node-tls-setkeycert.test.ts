/**
 * tlsSocket.setKeyCert() on a server-side socket. Node.js puts the certificate, the key and the CA of the context on the
 * connection, and the handshake goes on as before: the answer of the SNICallback is awaited and ALPN is negotiated.
 * https://github.com/nodejs/node/blob/v26.3.0/src/crypto/crypto_tls.cc#L1656-L1681
 *
 * Works with both:
 *   bun bd test test/js/node/tls/node-tls-setkeycert.test.ts
 *   node --test test/js/node/tls/node-tls-setkeycert.test.ts
 */
import assert from "node:assert";
import { once } from "node:events";
import { readFileSync } from "node:fs";
import net from "node:net";
import { join } from "node:path";
import { describe, test } from "node:test";
import tls from "node:tls";

const keys = join(import.meta.dirname, "..", "test", "fixtures", "keys");
const pem = (name: string) => readFileSync(join(keys, name));
const identity = (name: string) => ({ key: pem(`${name}-key.pem`), cert: pem(`${name}-cert.pem`) });
// The server's own identity is agent2. setKeyCert() moves the connection to agent1.
const own = identity("agent2");
const other = tls.createSecureContext(identity("agent1"));

type Answer = (err: Error | null, context?: tls.SecureContext) => void;
type SNICallback = (this: tls.TLSSocket, servername: string, answer: Answer) => void;
type Version = "TLSv1.2" | "TLSv1.3";

async function listen(server: net.Server) {
  await once(server.listen(0, "127.0.0.1"), "listening");
  return { port: (server.address() as net.AddressInfo).port, host: "127.0.0.1" };
}

// A door hands each accepted socket to a server-side TLSSocket. On both, `this` in the SNICallback is that TLSSocket.
type Door = { dial: { port: number; host: string }; close(): void };
type Report = { onSecure?: (socket: tls.TLSSocket) => void; onError?: (err: Error) => void };
type OpenDoor = (options: tls.TlsOptions, report?: Report) => Promise<Door>;
const doors: Record<string, OpenDoor> = {
  "server.emit('connection', netSocket)": async (options, report = {}) => {
    const server = tls.createServer(options, socket => {
      socket.on("error", () => {});
      report.onSecure?.(socket);
    });
    server.on("tlsClientError", err => report.onError?.(err));
    const front = net.createServer(raw => server.emit("connection", raw));
    return { dial: await listen(front), close: () => front.close() };
  },
  "new TLSSocket(netSocket, { isServer: true })": async (options, report = {}) => {
    const front = net.createServer(raw => {
      const socket = new tls.TLSSocket(raw, { ...options, isServer: true });
      socket.on("error", err => report.onError?.(err));
      socket.on("secure", () => report.onSecure?.(socket));
    });
    return { dial: await listen(front), close: () => front.close() };
  },
};
const emit = doors["server.emit('connection', netSocket)"];

// When the SNICallback answers, after its setKeyCert() call.
const answers: Record<string, (answer: Answer) => void> = {
  "in the call": answer => answer(null),
  "from a microtask": answer => queueMicrotask(() => answer(null)),
  "on a later turn": answer => setImmediate(answer, null),
};

// An SNICallback that calls setKeyCert() and then answers in the call.
const applies = (context: () => tls.SecureContext): SNICallback =>
  function (_, answer) {
    this.setKeyCert(context());
    answer(null);
  };

const served = (client: tls.TLSSocket) => ({ cn: client.getPeerCertificate().subject.CN, alpn: client.alpnProtocol });

// One handshake that offers h2. `read` takes the result from the client, by default its certificate and protocol.
// `session` is the one that the server issues, which can come before or after 'secureConnect'.
async function handshake<T = ReturnType<typeof served>>(
  dial: Door["dial"],
  version: Version,
  options: tls.ConnectionOptions = {},
  read: (client: tls.TLSSocket, session: Promise<Buffer>) => T | Promise<T> = served as (client: tls.TLSSocket) => T,
) {
  const client = tls.connect({
    ...dial,
    servername: "a.test",
    ALPNProtocols: ["h2"],
    rejectUnauthorized: false,
    minVersion: version,
    maxVersion: version,
    ...options,
  });
  const session = once(client, "session").then(([issued]) => issued as Buffer);
  session.catch(() => {});
  try {
    await once(client, "secureConnect");
    return await read(client, session);
  } finally {
    client.destroy();
  }
}

// How many certificates the server sent: its own and the issuers that came with it.
function chainLength(client: tls.TLSSocket) {
  const sent = new Set<string>();
  let cert = client.getPeerCertificate(true);
  while (cert?.raw && !sent.has(cert.fingerprint256)) {
    sent.add(cert.fingerprint256);
    cert = cert.issuerCertificate;
  }
  return sent.size;
}

// The first flight of a client: one ClientHello record, for a peer that sends nothing more.
async function clientHello(version: Version) {
  const { promise, resolve } = Promise.withResolvers<Buffer>();
  const sink = net.createServer(raw => {
    let seen = Buffer.alloc(0);
    raw.on("error", () => {});
    raw.on("data", chunk => {
      seen = Buffer.concat([seen, chunk]);
      if (seen.length >= 5 && seen.length >= 5 + seen.readUInt16BE(3))
        resolve(seen.subarray(0, 5 + seen.readUInt16BE(3)));
    });
  });
  const client = tls.connect({
    ...(await listen(sink)),
    servername: "a.test",
    rejectUnauthorized: false,
    minVersion: version,
    maxVersion: version,
  });
  client.on("error", () => {});
  try {
    return await promise;
  } finally {
    client.destroy();
    sink.close();
  }
}

// The handshake messages in a flight of TLS 1.2, which sends them in the clear: the body of each, by its type.
function handshakeMessages(flight: Buffer) {
  const records: Buffer[] = [];
  for (let at = 0; at + 5 <= flight.length; at += 5 + flight.readUInt16BE(at + 3)) {
    if (flight[at] === 22) records.push(flight.subarray(at + 5, at + 5 + flight.readUInt16BE(at + 3)));
  }
  const stream = Buffer.concat(records);
  const messages = new Map<number, Buffer>();
  for (let at = 0; at + 4 <= stream.length; at += 4 + stream.readUIntBE(at + 1, 3)) {
    messages.set(stream[at], stream.subarray(at + 4, at + 4 + stream.readUIntBE(at + 1, 3)));
  }
  return messages;
}
const CERTIFICATE_REQUEST = 13;
const SERVER_HELLO_DONE = 14;

for (const [door, open] of Object.entries(doors)) {
  for (const version of ["TLSv1.2", "TLSv1.3"] as const) {
    describe(`setKeyCert() in an SNICallback, ${door}, ${version}`, () => {
      for (const [when, give] of Object.entries(answers)) {
        const SNICallback: SNICallback = function (_, answer) {
          this.setKeyCert(other);
          give(answer);
        };

        test(`ALPNProtocols still apply when the answer comes ${when}`, async () => {
          const opened = await open({ ...own, SNICallback, ALPNProtocols: ["h2"] });
          try {
            assert.deepStrictEqual(await handshake(opened.dial, version), { cn: "agent1", alpn: "h2" });
          } finally {
            opened.close();
          }
        });

        test(`the ALPNCallback still runs once when the answer comes ${when}`, async () => {
          let calls = 0;
          const ALPNCallback = ({ protocols }: { protocols: string[] }) => {
            calls++;
            return protocols[0];
          };
          const opened = await open({ ...own, SNICallback, ALPNCallback });
          try {
            const got = await handshake(opened.dial, version);
            assert.deepStrictEqual({ ...got, calls }, { cn: "agent1", alpn: "h2", calls: 1 });
          } finally {
            opened.close();
          }
        });
      }

      // The peer sends its ClientHello and nothing more, so every byte it gets was sent before the answer.
      test("the server sends nothing before the answer, and a refusal drops the connection", async () => {
        const refusal = new Error("denied");
        const reported = Promise.withResolvers<Error>();
        let secured = false;
        const SNICallback: SNICallback = function (_, answer) {
          this.setKeyCert(other);
          setImmediate(answer, refusal);
        };
        const hello = await clientHello(version);
        const opened = await open(
          { ...own, SNICallback },
          { onSecure: () => (secured = true), onError: reported.resolve },
        );
        const peer = net.connect(opened.dial);
        let received = 0;
        peer.on("error", () => {});
        peer.on("data", chunk => (received += chunk.length));
        try {
          peer.write(hello);
          const [err] = await Promise.all([reported.promise, once(peer, "close")]);
          assert.deepStrictEqual(
            { received, secured, isTheRefusal: err === refusal },
            { received: 0, secured: false, isTheRefusal: true },
          );
        } finally {
          peer.destroy();
          opened.close();
        }
      });
    });

    // The use that the Node.js documentation names for setKeyCert().
    test(`setKeyCert() in an ALPNCallback replaces the certificate, ${door}, ${version}`, async () => {
      const ALPNCallback = function (this: tls.TLSSocket, { protocols }: { protocols: string[] }) {
        this.setKeyCert(other);
        return protocols[0];
      };
      const opened = await open({ ...own, ALPNCallback });
      try {
        assert.deepStrictEqual(await handshake(opened.dial, version), { cn: "agent1", alpn: "h2" });
      } finally {
        opened.close();
      }
    });
  }
}

for (const version of ["TLSv1.2", "TLSv1.3"] as const) {
  describe(`what setKeyCert() puts on the connection, ${version}`, () => {
    test("the last of two calls wins", async () => {
      const last = tls.createSecureContext(identity("agent3"));
      const SNICallback: SNICallback = function (_, answer) {
        this.setKeyCert(other);
        this.setKeyCert(last);
        answer(null);
      };
      const opened = await emit({ ...own, SNICallback, ALPNProtocols: ["h2"] });
      try {
        assert.deepStrictEqual(await handshake(opened.dial, version), { cn: "agent3", alpn: "h2" });
      } finally {
        opened.close();
      }
    });

    test("a context without a certificate throws, and the connection keeps its own", async () => {
      const thrown: unknown[] = [];
      const SNICallback: SNICallback = function (_, answer) {
        for (const context of [tls.createSecureContext(), tls.createSecureContext({ ca: pem("ca1-cert.pem") })]) {
          try {
            this.setKeyCert(context);
          } catch (err) {
            thrown.push(err);
          }
        }
        answer(null);
      };
      const opened = await emit({ ...own, SNICallback, ALPNProtocols: ["h2"] });
      try {
        const got = await handshake(opened.dial, version);
        assert.deepStrictEqual(
          { ...got, thrown: thrown.map(err => (err instanceof Error ? `${err.name}: ${err.message}` : err)) },
          { cn: "agent2", alpn: "h2", thrown: ["Error: SetKeyCert", "Error: SetKeyCert"] },
        );
      } finally {
        opened.close();
      }
    });

    // The certificate follows the cipher suite (TLS 1.2) or the signature algorithm (TLS 1.3), and an ECDSA client
    // keeps the ECDSA certificate.
    test("a key of another type in an ALPNCallback leaves the certificate", async () => {
      const ALPNCallback = function (this: tls.TLSSocket, { protocols }: { protocols: string[] }) {
        this.setKeyCert(other);
        return protocols[0];
      };
      const opened = await emit({ ...identity("ec10"), ALPNCallback });
      try {
        assert.deepStrictEqual(await handshake(opened.dial, version), { cn: "agent10.example.com", alpn: "h2" });
      } finally {
        opened.close();
      }
    });

    // ca1 issued agent1 and ca2 issued agent3.
    test("the CA of the context verifies the client certificate", async () => {
      const trustsCa2 = tls.createSecureContext({ ...identity("agent1"), ca: pem("ca2-cert.pem") });
      let verdict = Promise.withResolvers<string>();
      const opened = await emit(
        {
          ...own,
          ca: pem("ca1-cert.pem"),
          requestCert: true,
          rejectUnauthorized: false,
          SNICallback: applies(() => trustsCa2),
        },
        { onSecure: socket => verdict.resolve(socket.authorized ? "authorized" : String(socket.authorizationError)) },
      );
      try {
        const verdicts: string[] = [];
        for (const client of ["agent1", "agent3"]) {
          verdicts.push(await handshake(opened.dial, version, identity(client), () => verdict.promise));
          verdict = Promise.withResolvers<string>();
        }
        assert.deepStrictEqual(verdicts, ["UNABLE_TO_VERIFY_LEAF_SIGNATURE", "authorized"]);
      } finally {
        opened.close();
      }
    });

    // agent6.pfx holds the two certificates above agent6, and agent6-cert.pem holds the first of them.
    test("the intermediate certificates of the context are sent", async () => {
      const contexts = [
        tls.createSecureContext({ pfx: pem("agent6.pfx"), passphrase: "sample" }),
        tls.createSecureContext(identity("agent6")),
      ];
      let next = 0;
      const opened = await emit({ ...own, SNICallback: applies(() => contexts[next++]) });
      try {
        const sent: number[] = [];
        for (const _ of contexts) sent.push(await handshake(opened.dial, version, {}, chainLength));
        assert.deepStrictEqual(sent, [3, 2]);
      } finally {
        opened.close();
      }
    });
  });
}

describe("what setKeyCert() puts on the connection, TLSv1.2 only", () => {
  test("the cipher suites of the context do not apply", async () => {
    const aes256 = tls.createSecureContext({ ...identity("agent1"), ciphers: "ECDHE-RSA-AES256-GCM-SHA384" });
    const opened = await emit({ ...own, ciphers: "ECDHE-RSA-AES128-GCM-SHA256", SNICallback: applies(() => aes256) });
    try {
      const got = await handshake(opened.dial, "TLSv1.2", {}, client => ({
        cn: client.getPeerCertificate().subject.CN,
        cipher: client.getCipher().name,
      }));
      assert.deepStrictEqual(got, { cn: "agent1", cipher: "ECDHE-RSA-AES128-GCM-SHA256" });
    } finally {
      opened.close();
    }
  });

  // With this cipher suite the client encrypts to the key of the certificate that it got.
  test("an RSA key exchange uses the key that an ALPNCallback set", async () => {
    const ALPNCallback = function (this: tls.TLSSocket, { protocols }: { protocols: string[] }) {
      this.setKeyCert(other);
      return protocols[0];
    };
    const opened = await emit({ ...own, ciphers: "AES128-GCM-SHA256", ALPNCallback });
    try {
      const got = await handshake(opened.dial, "TLSv1.2", { ciphers: "AES128-GCM-SHA256" }, client => ({
        ...served(client),
        cipher: client.getCipher().name,
      }));
      assert.deepStrictEqual(got, { cn: "agent1", alpn: "h2", cipher: "AES128-GCM-SHA256" });
    } finally {
      opened.close();
    }
  });

  // A server names the CAs it accepts in its CertificateRequest. The peer reads that message and stops.
  for (const [which, ca, expected] of [
    ["a CA", { ca: pem("ca2-cert.pem") }, { ca1: false, ca2: true }],
    ["no CA", {}, { ca1: false, ca2: false }],
  ] as const) {
    test(`the request for a client certificate names the CA of a context with ${which}`, async () => {
      const context = tls.createSecureContext({ ...own, ...ca });
      const hello = await clientHello("TLSv1.2");
      const opened = await emit({
        ...own,
        ca: pem("ca1-cert.pem"),
        requestCert: true,
        rejectUnauthorized: false,
        SNICallback: applies(() => context),
      });
      const peer = net.connect(opened.dial);
      const flight = Promise.withResolvers<Map<number, Buffer>>();
      let received = Buffer.alloc(0);
      peer.on("error", flight.reject);
      peer.on("close", () => flight.reject(new Error("the server closed before its ServerHelloDone")));
      peer.on("data", chunk => {
        received = Buffer.concat([received, chunk]);
        const messages = handshakeMessages(received);
        if (messages.has(SERVER_HELLO_DONE)) flight.resolve(messages);
      });
      try {
        peer.write(hello);
        const names = (await flight.promise).get(CERTIFICATE_REQUEST)?.toString("latin1");
        assert.deepStrictEqual({ ca1: names?.includes("ca1"), ca2: names?.includes("ca2") }, expected);
      } finally {
        peer.destroy();
        opened.close();
      }
    });
  }
});

// Bun differs from Node.js in these. Each test states both results.
const onBun = typeof Bun !== "undefined";

for (const version of ["TLSv1.2", "TLSv1.3"] as const) {
  describe(`where setKeyCert() differs from Node.js, ${version}`, () => {
    // Bun keeps the sessions of two contexts apart, as it does for the contexts that SNI selects.
    test("a session is resumed only under the context that issued it", async () => {
      const contexts: Record<string, tls.SecureContext> = {
        "a.test": tls.createSecureContext(identity("agent1")),
        "b.test": tls.createSecureContext(identity("agent3")),
      };
      const SNICallback: SNICallback = function (servername, answer) {
        this.setKeyCert(contexts[servername]);
        answer(null);
      };
      // BoringSSL holds the session tickets of TLS 1.3 back until the server writes.
      const opened = await emit({ ...own, SNICallback }, { onSecure: socket => socket.end("x") });
      try {
        const session = await handshake(opened.dial, version, {}, (_, issued) => issued);
        const reused = (servername: string) =>
          handshake(opened.dial, version, { servername, session }, client => client.isSessionReused());
        assert.deepStrictEqual(
          { "a.test": await reused("a.test"), "b.test": await reused("b.test") },
          { "a.test": true, "b.test": !onBun },
        );
      } finally {
        opened.close();
      }
    });

    // OpenSSL picks the certificate after the ALPNCallback, and BoringSSL before it. Bun replaces the certificate when
    // the new key fits what the handshake picked for the old one, and leaves it otherwise.
    for (const [which, from, to, bun, node] of [
      [
        "of another curve",
        "ec10",
        { key: "p521-key.pem", cert: "p521-cert.pem" },
        "agent10.example.com",
        "p521-localhost",
      ],
      [
        "of another type, for a client that prefers it",
        "agent2",
        { key: "ec10-key.pem", cert: "ec10-cert.pem" },
        "agent2",
        version === "TLSv1.3" ? "agent10.example.com" : "agent2",
      ],
    ] as const) {
      test(`a key ${which} in an ALPNCallback`, async () => {
        const dir = to.key.startsWith("p521") ? join(import.meta.dirname, "fixtures") : keys;
        const context = tls.createSecureContext({
          key: readFileSync(join(dir, to.key)),
          cert: readFileSync(join(dir, to.cert)),
        });
        const ALPNCallback = function (this: tls.TLSSocket, { protocols }: { protocols: string[] }) {
          this.setKeyCert(context);
          return protocols[0];
        };
        const opened = await emit({ ...identity(from), ALPNCallback });
        try {
          assert.deepStrictEqual(await handshake(opened.dial, version), { cn: onBun ? bun : node, alpn: "h2" });
        } finally {
          opened.close();
        }
      });
    }

    // The key of agent11 has 512 bits, which Node.js refuses in a context. It is too short for the signature that
    // the handshake picked for the key of agent2.
    (onBun ? test : test.skip)("a shorter RSA key in an ALPNCallback leaves the certificate", async () => {
      const context = tls.createSecureContext(identity("agent11"));
      const ALPNCallback = function (this: tls.TLSSocket, { protocols }: { protocols: string[] }) {
        this.setKeyCert(context);
        return protocols[0];
      };
      const opened = await emit({ ...own, ALPNCallback });
      try {
        assert.deepStrictEqual(await handshake(opened.dial, version), { cn: "agent2", alpn: "h2" });
      } finally {
        opened.close();
      }
    });

    // Here agent6 comes alone, and the two certificates above it are the `ca` of the context. Bun sends them, as a
    // server with that context does.
    test("the issuers that the context has as its CA", async () => {
      const [certificate] = pem("agent6-cert.pem")
        .toString()
        .split(/(?<=-----END CERTIFICATE-----)/);
      const context = tls.createSecureContext({
        key: pem("agent6-key.pem"),
        cert: certificate,
        ca: [pem("ca3-cert.pem"), pem("ca1-cert.pem")],
      });
      const opened = await emit({ ...own, SNICallback: applies(() => context) });
      try {
        assert.strictEqual(await handshake(opened.dial, version, {}, chainLength), onBun ? 3 : 1);
      } finally {
        opened.close();
      }
    });

    // Node.js copies one certificate and one key out of the context. Bun serves every identity of the context.
    test("a context with an RSA and an ECDSA identity", async () => {
      const rsa = identity("agent1");
      const ecdsa = identity("ec10");
      const context = tls.createSecureContext({ key: [rsa.key, ecdsa.key], cert: [rsa.cert, ecdsa.cert] });
      const only = (type: "RSA" | "ECDSA"): tls.ConnectionOptions =>
        version === "TLSv1.2"
          ? { ciphers: `ECDHE-${type}-AES128-GCM-SHA256` }
          : { sigalgs: type === "RSA" ? "rsa_pss_rsae_sha256" : "ecdsa_secp256r1_sha256" };
      const opened = await emit({ ...identity("agent3"), SNICallback: applies(() => context), ALPNProtocols: ["h2"] });
      try {
        assert.deepStrictEqual(
          {
            "RSA only": await handshake(opened.dial, version, only("RSA")),
            "ECDSA only": await handshake(opened.dial, version, only("ECDSA")),
          },
          {
            "RSA only": { cn: onBun ? "agent1" : "agent3", alpn: "h2" },
            "ECDSA only": { cn: "agent10.example.com", alpn: "h2" },
          },
        );
      } finally {
        opened.close();
      }
    });

    // Node.js ignores the call on a client socket. Bun applies it.
    test("a client socket", async () => {
      const context = tls.createSecureContext(identity("agent3"));
      const seen = Promise.withResolvers<unknown>();
      const opened = await emit(
        { ...own, requestCert: true, rejectUnauthorized: false },
        { onSecure: socket => seen.resolve(socket.getPeerCertificate().subject?.CN) },
      );
      const client = tls.connect({
        ...opened.dial,
        ...identity("agent1"),
        rejectUnauthorized: false,
        minVersion: version,
        maxVersion: version,
      });
      client.on("error", seen.reject);
      client.on("connect", () => client.setKeyCert(context));
      try {
        assert.strictEqual(await seen.promise, onBun ? "agent3" : "agent1");
      } finally {
        client.destroy();
        opened.close();
      }
    });
  });
}

// Only in Bun: when Node.js runs this file it must not spawn itself again.
if (typeof Bun !== "undefined") {
  const node = Bun.which("node");
  describe("Node.js compatibility", () => {
    (node ? test : test.skip)("all tests pass in Node.js", { timeout: 120_000 }, async () => {
      await using proc = Bun.spawn({
        // A test that hangs in Node.js fails by name instead of running this one out of time.
        cmd: [node!, "--test-timeout=15000", "--test-force-exit", import.meta.filename],
        stdout: "pipe",
        stderr: "pipe",
        stdin: "ignore",
      });
      const [stdout, stderr, exitCode] = await Promise.all([proc.stdout.text(), proc.stderr.text(), proc.exited]);
      assert.deepStrictEqual({ exitCode, output: exitCode === 0 ? "" : stdout + stderr }, { exitCode: 0, output: "" });
    });
  });
}
