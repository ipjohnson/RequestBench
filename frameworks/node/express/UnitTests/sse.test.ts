import assert from "node:assert/strict";
import { test } from "node:test";

import request from "supertest";

import { app, expected } from "./app.ts";

// rb:test sse.medium
test("sse.medium: each row of items.medium is the data of one event", async () => {
  const response = await request(app).get("/sse/medium").set("accept", "text/event-stream");

  assert.equal(response.status, 200);
  assert.match(response.headers["content-type"]!, /^text\/event-stream/);
  assert.equal(response.headers["content-length"], undefined);
  const events = response.text.split("\n\n").filter((e) => e !== "");
  assert.deepEqual(
    events.map((e) => JSON.parse(e.replace(/^data: /, ""))),
    expected.json("items.medium.json").items,
  );
});
