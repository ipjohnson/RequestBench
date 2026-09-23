// The pool against a server that writes each answer byte for byte, so its framing and its
// connection header are exactly what a test says they are.
//
//   node --experimental-strip-types --test traffic-generator/wire.test.ts
import assert from "node:assert/strict";
import net from "node:net";
import { after, before, test } from "node:test";

import { Pool, type Answer, type Request } from "./wire.ts";

const GET: Request = { bytes: Buffer.from("GET /x HTTP/1.1\r\nhost: stub\r\n\r\n"), head: false };
const HEAD: Request = { bytes: Buffer.from("HEAD /x HTTP/1.1\r\nhost: stub\r\n\r\n"), head: true };
const OK = "HTTP/1.1 200 OK\r\ncontent-length: 2\r\n\r\n{}";

/** What the server writes to the next request, whatever it asks. */
let answer = OK;
/** Every connection the server has accepted, in order. */
const accepted: net.Socket[] = [];
let server: net.Server;
let port = 0;

before(async () => {
  server = net.createServer((socket) => {
    accepted.push(socket);
    let head = "";
    socket.on("data", (chunk: Buffer) => {
      head += chunk.toString("latin1");
      if (!head.includes("\r\n\r\n")) return;
      head = "";
      socket.write(answer);
      if (/\r\nconnection: close\r\n/i.test(answer)) socket.end();
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  port = (server.address() as net.AddressInfo).port;
});

after(() => {
  for (const socket of accepted) socket.destroy();
  return new Promise<void>((resolve) => server.close(() => resolve()));
});

/** The answer, and how many connections were free when the pool counted it. */
function sent(pool: Pool, request: Request): Promise<{ readonly answer: Answer; readonly idle: number }> {
  return new Promise((resolve, reject) => pool.send(request, (a) => resolve({ answer: a, idle: pool.idle }), reject));
}

test("an answer that closes its connection is counted once the connection replacing it is open", async () => {
  const pool = new Pool("127.0.0.1", port);
  await pool.open(1);
  const opened = accepted.length;

  answer = "HTTP/1.1 200 OK\r\ncontent-length: 2\r\nconnection: close\r\n\r\n{}";
  const closing = await sent(pool, GET);
  answer = OK;
  const next = await sent(pool, GET);
  pool.destroy();

  assert.equal(closing.answer.status, 200);
  assert.equal(closing.idle, 1, "the replacement was open and free when the closing answer was counted");
  assert.equal(next.answer.status, 200);
  assert.equal(accepted.length - opened, 1, "the next request went out on the replacement");
});

test("a HEAD answer with no length ends at its headers and keeps its connection", async () => {
  const pool = new Pool("127.0.0.1", port);
  await pool.open(1);
  const opened = accepted.length;

  answer = "HTTP/1.1 200 OK\r\ncontent-type: application/json\r\n\r\n";
  const head = await sent(pool, HEAD);
  answer = OK;
  await sent(pool, GET);
  pool.destroy();

  assert.equal(head.answer.status, 200);
  assert.equal(head.answer.bodyBytes, 0);
  assert.equal(head.idle, 1);
  assert.equal(accepted.length, opened, "both requests went out on one connection");
});

test("a connection the framework closes while idle is opened again only when a request needs one", async () => {
  const pool = new Pool("127.0.0.1", port);
  await pool.open(1);
  const opened = accepted.length;

  accepted.at(-1)!.end();
  await new Promise((resolve) => setTimeout(resolve, 50));
  const idle = pool.idle;
  const reopened = accepted.length - opened;
  answer = OK;
  const next = await sent(pool, GET);
  pool.destroy();

  assert.equal(idle, 0);
  assert.equal(reopened, 0, "nothing chased the idle close");
  assert.equal(next.answer.status, 200);
  assert.equal(accepted.length - opened, 1);
});
