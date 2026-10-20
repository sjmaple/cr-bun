// An HTTP/1.1 client of http2.createSecureServer({ allowHTTP1: true }) that came through
// server.emit("connection", rawSocket). What a 'clientError' listener throws there is an uncaught
// exception, as in Node.js. It is not an error of the socket, and the socket stays open.
// Prints one JSON line. Runs under Node.js too.
const fs = require("node:fs");
const http2 = require("node:http2");
const net = require("node:net");
const path = require("node:path");
const tls = require("node:tls");

const keys = path.join(__dirname, "..", "test", "fixtures", "keys");
const key = fs.readFileSync(path.join(keys, "agent1-key.pem"));
const cert = fs.readFileSync(path.join(keys, "agent1-cert.pem"));

const result = { outcome: "", uncaught: [], listenerCalls: 0, socketDestroyed: undefined };
let serverSocket;
let client;

const server = http2.createSecureServer({ key, cert, allowHTTP1: true }, (req, res) => {
  serverSocket = req.socket;
  res.end("ok");
});
server.on("clientError", err => {
  result.listenerCalls++;
  throw new Error(`listener threw on ${err.code}`);
});
const front = net.createServer(socket => server.emit("connection", socket));

function finish(outcome) {
  if (result.outcome) return;
  result.outcome = outcome;
  result.socketDestroyed = serverSocket?.destroyed;
  console.log(JSON.stringify(result));
  client.destroy();
  front.close();
  server.close();
  process.exit(0);
}

process.on("uncaughtException", err => {
  result.uncaught.push(err.code ?? err.message);
  finish("uncaught exception");
});

front.listen(0, "127.0.0.1", () => {
  client = tls.connect({
    host: "127.0.0.1",
    port: front.address().port,
    rejectUnauthorized: false,
    ALPNProtocols: ["http/1.1"],
  });
  let answered = false;
  client.on("error", () => {});
  client.on("secureConnect", () => client.write("GET / HTTP/1.1\r\nHost: x\r\n\r\n"));
  // The bad bytes come in a read of their own, behind the first response.
  client.on("data", () => {
    if (answered) return;
    answered = true;
    client.write("GARBAGE\r\n\r\n");
  });
  client.on("close", () => finish("the connection closed"));
});
