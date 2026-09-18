/**
 * cache: the framework's own response cache, and what it is keyed on.
 *
 * The vary rows are the ones worth having. A store keyed on fewer headers than it declares
 * answers one tenant with another tenant's body, and that is a correctness failure a latency
 * chart renders as a target that got faster.
 */
import { test } from "node:test";
import * as floor from "./floor.js";
import * as planned from "./planned.js";
import { send } from "./fetch.js";

// rb:test cache.small
test("the small cached response is what the spec pins", async () => {
  const a = planned.ask("cache.small");

  const answer = await send(a);

  floor.check(a, answer);
});

// rb:test cache.medium
test("the medium one is too", async () => {
  const a = planned.ask("cache.medium");

  const answer = await send(a);

  floor.check(a, answer);
});

// rb:test cache.large
test("and the large one", async () => {
  const a = planned.ask("cache.large");

  const answer = await send(a);

  floor.check(a, answer);
});

// rb:test cache.vary_one
test("a response varying on one header says so", async () => {
  const a = planned.ask("cache.vary_one");

  const answer = await send(a);

  floor.check(a, answer);
});

// rb:test cache.vary_many
test("and one varying on three says all three", async () => {
  const a = planned.ask("cache.vary_many");

  const answer = await send(a);

  floor.check(a, answer);
});
