import assert from "node:assert/strict";
import { test } from "node:test";

import { app, expected } from "./app.ts";

// rb:test static.small,static.medium,static.large
for (const [id, name] of [["static.small", "items.small.json"], ["static.medium", "items.medium.json"], ["static.large", "items.large.json"]] as const) {
  test(`${id}: the committed file is served byte for byte`, async () => {
    const file = expected.bytes(name);

    const response = await app.request(`/static/${name}`);

    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type")!, /^application\/json/);
    assert.equal(response.headers.get("content-length"), String(file.length));
    assert.notEqual(response.headers.get("last-modified"), null);
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), file);
  });
}

test("a file the directory does not hold is the not-found handler's 404", async () => {
  const response = await app.request("/static/nothing.json");

  assert.equal(response.status, 404);
});
