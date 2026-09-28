import assert from "node:assert/strict";
import { test } from "node:test";

import { app, expected } from "./app.ts";

// rb:test static.small,static.medium,static.large
for (const [id, name] of [["static.small", "items.small.json"], ["static.medium", "items.medium.json"], ["static.large", "items.large.json"]] as const) {
  test(`${id}: the committed file is served byte for byte`, async () => {
    const file = expected.bytes(name);

    const response = await app.inject({ method: "GET", url: `/static/${name}` });

    assert.equal(response.statusCode, 200);
    assert.match(response.headers["content-type"] as string, /^application\/json/);
    assert.equal(response.headers["content-length"], String(file.length));
    assert.notEqual(response.headers["last-modified"], undefined);
    assert.deepEqual(response.rawPayload, file);
  });
}
