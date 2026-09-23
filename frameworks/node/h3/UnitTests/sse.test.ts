import assert from "node:assert/strict";
import { test } from "node:test";

import { app, expected } from "./app.ts";

// rb:test sse.medium
test("sse.medium: each row of items.medium is the data of one event", async () => {
  const response = await app.request("/sse/medium", { headers: { accept: "text/event-stream" } });

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type")!, /^text\/event-stream/);
  assert.equal(response.headers.get("content-length"), null);
  const events = (await response.text()).split("\n\n").filter((e) => e !== "");
  assert.deepEqual(
    events.map((e) => JSON.parse(e.replace(/^data: /, ""))),
    expected.json("items.medium.json").items,
  );
});
