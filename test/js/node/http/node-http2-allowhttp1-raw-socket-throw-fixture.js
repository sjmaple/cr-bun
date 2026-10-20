// An HTTP/1.1 client of http2.createSecureServer({ allowHTTP1: true }) that came through
// server.emit("connection", rawSocket). What node:http's connection listener or a 'clientError'
// listener throws there is an uncaught exception, as in Node.js. It is not an error of the socket.
// Prints one JSON line. Runs under Node.js too.
const fs = require("node:fs");
const http2 = require("node:http2");
const net = require("node:net");
const path = require("node:path");
const tls = require("node:tls");

const keys = path.join(__dirname, "..", "test", "fixtures", "keys");
const key = fs.readFileSync(path.join(keys, "agent1-key.pem"));
const cert = fs.readFileSync(path.join(keys, "agent1-cert.pem"));

const uncaught = [];
let onUncaught = () => {};
process.on("uncaughtException", err => {
  uncaught.push(err.code ?? err.message);
  onUncaught();
});

// `configure` sets the server up. `afterResponse` is what the client writes when its first request is answered.
function scenario(configure, afterResponse) {
  const { promise, resolve } = Promise.withResolvers();
  const result = { outcome: "", uncaught: [], listenerCalls: 0, socketDestroyed: undefined };
  let serverSocket;
  const server = http2.createSecureServer({ key, cert, allowHTTP1: true }, (req, res) => {
    serverSocket = req.socket;
    res.end("ok");
  });
  configure(server, result);
  const front = net.createServer(socket => server.emit("connection", socket));
  front.listen(0, "127.0.0.1", () => {
    const client = tls.connect({
      host: "127.0.0.1",
      port: front.address().port,
      rejectUnauthorized: false,
      ALPNProtocols: ["http/1.1"],
    });
    let answered = false;
    function finish(outcome) {
      if (result.outcome) return;
      result.outcome = outcome;
      result.uncaught = uncaught.splice(0);
      result.socketDestroyed = serverSocket?.destroyed;
      onUncaught = () => {};
      client.destroy();
      front.close();
      server.close();
      resolve(result);
    }
    onUncaught = () => finish("uncaught exception");
    client.on("error", () => {});
    client.on("secureConnect", () => client.write("GET / HTTP/1.1\r\nHost: x\r\n\r\n"));
    client.on("data", () => {
      if (answered) return;
      answered = true;
      if (afterResponse) client.write(afterResponse);
      else finish("the request was answered");
    });
    client.on("close", () => finish("the connection closed"));
  });
  return promise;
}

(async () => {
  // server.timeout is what the connection listener gives to socket.setTimeout(), which rejects a string.
  const badTimeout = await scenario(server => {
    server.timeout = "500";
  });
  const throwingListener = await scenario((server, result) => {
    server.on("clientError", err => {
      result.listenerCalls++;
      throw new Error(`listener threw on ${err.code}`);
    });
  }, "GARBAGE\r\n\r\n");
  console.log(
    JSON.stringify({
      badTimeout: { outcome: badTimeout.outcome, uncaught: badTimeout.uncaught },
      throwingListener: {
        outcome: throwingListener.outcome,
        uncaught: throwingListener.uncaught,
        listenerCalls: throwingListener.listenerCalls,
        socketDestroyed: throwingListener.socketDestroyed,
      },
    }),
  );
  process.exit(0);
})();
