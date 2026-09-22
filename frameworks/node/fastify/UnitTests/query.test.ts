import assert from "node:assert/strict";
import { test } from "node:test";

import { app, expected, run } from "./app.ts";

const SEARCH = ["page", "size", "status", "category", "sort", "q", "minPrice", "maxPrice"] as const;

// rb:test query.one
test("query.one: the page is echoed as an integer", async () => {
  const response = await app.inject({ method: "GET", url: "/query/one", query: { page: String(run.page) } });

  assert.deepEqual(response.json(), expected.withEcho("items.small.json", { page: run.page }));
});

// rb:test query.many
test("query.many: eight values are echoed, the numbers as integers", async () => {
  const query = Object.fromEntries(SEARCH.map((name) => [name, String(run[name])]));

  const response = await app.inject({ method: "GET", url: "/query/many", query });

  assert.deepEqual(response.json(), expected.withEcho("items.small.json", Object.fromEntries(SEARCH.map((name) => [name, run[name]]))));
});

test("a missing value is refused by the querystring schema", async () => {
  const response = await app.inject({ method: "GET", url: "/query/one" });

  assert.equal(response.statusCode, 400);
  assert.equal(response.json().message, "querystring must have required property 'page'");
});
