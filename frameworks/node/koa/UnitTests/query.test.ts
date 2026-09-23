import assert from "node:assert/strict";
import { test } from "node:test";

import { client, expected, run } from "./app.ts";

const SEARCH = ["page", "size", "status", "category", "sort", "q", "minPrice", "maxPrice"] as const;

// rb:test query.one
test("query.one: the page is echoed as a number", async () => {
  const response = await client.get("/query/one").query({ page: String(run.page) });

  assert.deepEqual(response.body, expected.withEcho("items.small.json", { page: run.page }));
});

// rb:test query.many
test("query.many: eight values are echoed, the numbers converted", async () => {
  const query = Object.fromEntries(SEARCH.map((name) => [name, String(run[name])]));

  const response = await client.get("/query/many").query(query);

  assert.deepEqual(response.body, expected.withEcho("items.small.json", Object.fromEntries(SEARCH.map((name) => [name, run[name]]))));
});
