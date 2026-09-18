/**
 * etag: the validator a target computes, and what it does when one comes back.
 *
 * The 304 is the interesting one: it is the only request in the corpus that cannot be sent until
 * the target has answered a different one, because the validator is the target's to produce.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import * as floor from "./floor.js";
import * as planned from "./planned.js";
import { send, sendAfterCapture } from "./fetch.js";

// rb:test etag.small
test("the small response carries a validator", async () => {
  const a = planned.ask("etag.small");

  const answer = await send(a);

  floor.check(a, answer);
  assert.ok(answer.headers.etag);
});

// rb:test etag.large
test("so does the large one", async () => {
  const a = planned.ask("etag.large");

  const answer = await send(a);

  floor.check(a, answer);
  assert.ok(answer.headers.etag);
});

// rb:test etag.match_large
test("a validator the target just issued is answered with 304", async () => {
  const a = planned.ask("etag.match_large");

  const answer = await sendAfterCapture(a);

  floor.check(a, answer);
  assert.ok(!answer.contentType);
});

// rb:test etag.stale_large
test("a validator the target never issued is answered in full", async () => {
  const a = planned.ask("etag.stale_large");

  const answer = await send(a);

  floor.check(a, answer);
  assert.ok(answer.headers.etag);
});
