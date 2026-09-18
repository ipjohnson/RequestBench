/**
 * headers: request headers at a few and at many, read by nothing and bound.
 *
 * /headers reads none of them, so what its response can hold is that the request was accepted
 * with all of them attached. /headers/bind binds three and echoes them. planned.js fills the
 * pinned body with the values it sent, so the floor check holds each echoed value to what went
 * out, the integer included.
 */
import { test } from "node:test";
import * as floor from "./floor.js";
import * as planned from "./planned.js";
import { send } from "./fetch.js";

// rb:test headers.few
test("a request carrying a few headers is served", async () => {
  const a = planned.ask("headers.few");

  const answer = await send(a);

  floor.check(a, answer);
});

// rb:test headers.many
test("and one carrying many is served the same way", async () => {
  const a = planned.ask("headers.many");

  const answer = await send(a);

  floor.check(a, answer);
});

// rb:test headers.bind_few
test("three bound headers come back in the echo", async () => {
  const a = planned.ask("headers.bind_few");

  const answer = await send(a);

  floor.check(a, answer);
});

// rb:test headers.bind_many
test("and come back the same among many", async () => {
  const a = planned.ask("headers.bind_many");

  const answer = await send(a);

  floor.check(a, answer);
});
