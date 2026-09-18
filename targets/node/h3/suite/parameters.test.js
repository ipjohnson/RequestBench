/**
 * parameters: route capture, at zero, one and two segments.
 *
 * The captured values do not reach the answer. The payload is the shared one, so what these
 * hold is that the route matched at all: a target whose two-segment pattern is wrong answers
 * 404 and the floor says so on the status line before it ever looks at a body.
 */
import { test } from "node:test";
import * as floor from "./floor.js";
import * as planned from "./planned.js";
import { send } from "./fetch.js";

// rb:test parameters.static
test("a route with nothing to capture matches", async () => {
  const a = planned.ask("parameters.static");

  const answer = await send(a);

  floor.check(a, answer);
});

// rb:test parameters.one
test("one captured segment matches", async () => {
  const a = planned.ask("parameters.one");

  const answer = await send(a);

  floor.check(a, answer);
});

// rb:test parameters.two
test("two captured segments match", async () => {
  const a = planned.ask("parameters.two");

  const answer = await send(a);

  floor.check(a, answer);
});
