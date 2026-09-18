/**
 * domain: the eight operations that reach the shared model, including the four that write.
 *
 * The largest family and the one where a handler is doing something rather than returning
 * something. The writes are the ones a test earns its keep on: a 201 with no body and a 204
 * with no body are both answers a framework can get subtly wrong while returning the right
 * status, which is why the floor checks the kind of body even when there is none.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import * as floor from "./floor.js";
import * as planned from "./planned.js";
import { send } from "./inject.js";

// rb:test domain.lookup
test("one order is looked up", async () => {
  const a = planned.ask("domain.lookup");

  const answer = await send(a);

  floor.check(a, answer);
});

// rb:test domain.filter
test("a filtered list comes back", async () => {
  const a = planned.ask("domain.filter");

  const answer = await send(a);

  floor.check(a, answer);
});

// rb:test domain.join
test("a join across the model comes back", async () => {
  const a = planned.ask("domain.join");

  const answer = await send(a);

  floor.check(a, answer);
});

// rb:test domain.aggregate
test("an aggregate is computed", async () => {
  const a = planned.ask("domain.aggregate");

  const answer = await send(a);

  floor.check(a, answer);
});

// rb:test domain.create
test("a created order answers 201", async () => {
  const a = planned.ask("domain.create");

  const answer = await send(a);

  floor.check(a, answer);
});

// rb:test domain.replace
test("a replaced customer answers the new state", async () => {
  const a = planned.ask("domain.replace");

  const answer = await send(a);

  floor.check(a, answer);
});

// rb:test domain.patch
test("a patched customer answers the merged state", async () => {
  const a = planned.ask("domain.patch");

  const answer = await send(a);

  floor.check(a, answer);
});

// rb:test domain.delete
test("a deleted line answers 204 and no body", async () => {
  const a = planned.ask("domain.delete");

  const answer = await send(a);

  floor.check(a, answer);
  assert.equal(answer.raw.length, 0);
});
