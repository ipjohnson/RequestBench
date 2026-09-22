import assert from "node:assert/strict";
import { test } from "node:test";

import { app, expected } from "./app.ts";

// rb:test sse.medium
test("sse.medium: each row of items.medium is the data of one event", async () => {
  const response = await app.inject({ method: "GET", url: "/sse/medium", headers: { accept: "text/event-stream" } });

  assert.equal(response.statusCode, 200);
  assert.match(response.headers["content-type"] as string, /^text\/event-stream/);
  assert.equal(response.headers["content-length"], undefined);
  const events = response.body.split("\n\n").filter((e) => e !== "");
  assert.deepEqual(
    events.map((e) => JSON.parse(e.replace(/^data: /, ""))),
    expected.json("items.medium.json").items,
  );
});

test("a client that refuses event streams is answered 406", async () => {
  const response = await app.inject({ method: "GET", url: "/sse/medium", headers: { accept: "application/json" } });

  assert.equal(response.statusCode, 406);
});
