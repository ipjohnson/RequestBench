import assert from "node:assert/strict";
import { test } from "node:test";

import { app, expected, run } from "./app.ts";

const SEARCH = ["page", "size", "status", "category", "sort", "q", "minPrice", "maxPrice"] as const;

// rb:test query.one
test("query.one: the page is echoed as an integer", async () => {
  const response = await app.request(`/query/one?page=${run.page}`);

  assert.deepEqual(await response.json(), expected.withEcho("items.small.json", { page: run.page }));
});

// rb:test query.many
test("query.many: eight values are echoed, the numbers as integers", async () => {
  const query = new URLSearchParams(SEARCH.map((name) => [name, String(run[name])])).toString();

  const response = await app.request(`/query/many?${query}`);

  assert.deepEqual(await response.json(), expected.withEcho("items.small.json", Object.fromEntries(SEARCH.map((name) => [name, run[name]]))));
});

test("a missing value is refused by the query schema", async () => {
  const response = await app.request("/query/one");

  assert.equal(response.status, 400);
});
