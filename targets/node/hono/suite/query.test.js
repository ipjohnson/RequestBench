/**
 * query: parsing and coercing query parameters, at one and at eight.
 *
 * The values never reach the answer, which is the point: this family is the parse and the
 * coercion isolated from any use of them. A target that silently drops a parameter it cannot
 * coerce answers the same body as one that read all eight, so what these hold is the status.
 */
import { test } from "vitest";
import * as floor from "./floor.js";
import * as planned from "./planned.js";
import { send } from "./fetch.js";

// rb:test query.one
test("one query parameter is read", async () => {
  const a = planned.ask("query.one");

  const answer = await send(a);

  floor.check(a, answer);
});

// rb:test query.many
test("eight of them are read and coerced", async () => {
  const a = planned.ask("query.many");

  const answer = await send(a);

  floor.check(a, answer);
});
