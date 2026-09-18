/**
 * query: parsing, percent-decoding and coercing query parameters, at one and at eight.
 *
 * The answer is the small payload with the converted values echoed beside it. The plan
 * reader puts the values it drew into both the path and the pinned body, so the floor check
 * is an echo check: a parameter the target dropped, did not coerce or did not decode differs
 * from what was sent. q holds a space sent as %20, which only a percent-decoder turns back
 * into a space.
 */
import { test } from "node:test";
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
