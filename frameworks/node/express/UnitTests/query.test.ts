import assert from "node:assert/strict";
import { test } from "node:test";

import request from "supertest";

import { app, expected, run } from "./app.ts";

const SEARCH = ["page", "size", "status", "category", "sort", "q", "minPrice", "maxPrice"] as const;

// rb:test query.one
test("query.one: the page is echoed as an integer", async () => {
  const response = await request(app).get("/query/one").query({ page: String(run.page) });

  assert.deepEqual(response.body, expected.withEcho("items.small.json", { page: run.page }));
});

// rb:test query.many
test("query.many: eight values are echoed, the numbers as integers", async () => {
  const query = Object.fromEntries(SEARCH.map((name) => [name, String(run[name])]));

  const response = await request(app).get("/query/many").query(query);

  assert.deepEqual(response.body, expected.withEcho("items.small.json", Object.fromEntries(SEARCH.map((name) => [name, run[name]]))));
});

test("nothing checks a query value, so a missing page is written back as null", async () => {
  const response = await request(app).get("/query/one");

  assert.equal(response.status, 200);
  assert.equal(response.body.echo.page, null);
});
